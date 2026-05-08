/**
 * Foliate.js Engine Module
 * Handles Foliate.js specific rendering, theming, and event handling.
 * Uses renderer.setStyles() for CSS injection
 */

import 'https://cdn.jsdelivr.net/gh/johnfactotum/foliate-js@main/view.js';

window.foliateView = null;
window.foliateCurrentCfi = null;
window.taskbarToggleBtn = null;

/**
 * Launch Foliate.js engine for a specific book
 */
window.launchFoliateEngine = async function(bookId) {
    // --- LOAD SETTINGS BEFORE ENGINE BOOTS ---
    window.loadReaderSettings();
    
    // --- SAVE READ MODE BEFORE THE RESTART LOOP HAPPENS ---
    const modeDropdown = document.getElementById('set-read-mode');
    if (modeDropdown && !modeDropdown.dataset.modeSaved) {
        modeDropdown.addEventListener('change', function() {
            try {
                const settings = JSON.parse(localStorage.getItem('reader-settings')) || {};
                settings.readMode = this.value;
                localStorage.setItem('reader-settings', JSON.stringify(settings));
            } catch(e) {}
        });
        modeDropdown.dataset.modeSaved = "true";
    }

    try {
        const bookData = await localforage.getItem(bookId);
        if (!bookData) throw new Error("Could not retrieve book from database.");
        
        const actualBuffer = bookData.buffer || bookData; 
        if (!actualBuffer || actualBuffer.byteLength === 0) throw new Error("Book file is empty or corrupted.");

        const viewerContainer = document.getElementById('viewer');
        viewerContainer.innerHTML = ''; 
        
        await customElements.whenDefined('foliate-view');
        window.foliateView = document.createElement('foliate-view');
        window.foliateView.style.width = '100%';
        window.foliateView.style.height = '100%';
        window.foliateView.style.display = 'block';
        
        const readMode = document.getElementById('set-read-mode').value;
        const targetLayout = (readMode === 'continuous' || readMode === 'scrolled') ? 'scrolled' : 'paginated';
        window.foliateView.setAttribute('layout', targetLayout);
        
        viewerContainer.appendChild(window.foliateView);

        // Foliate-specific: Create rendition-like interface
        window.rendition = {
            next: () => { if (window.foliateView) window.foliateView.next(); },
            prev: () => { if (window.foliateView) window.foliateView.prev(); },
            display: (loc) => { if (window.foliateView) window.foliateView.goTo(loc); },
            currentLocation: () => { return { start: { cfi: window.foliateCurrentCfi } }; }
        };

        // Cache for the CSS template
        let foliateCssTemplateCache = null;
        
        /**
         * Load CSS template from file
         */
        async function loadFoliateCSSTemplate() {
            if (foliateCssTemplateCache) return foliateCssTemplateCache;
            try {
                const response = await fetch('css/reader/foliate-overrides.css');
                foliateCssTemplateCache = await response.text();
                return foliateCssTemplateCache;
            } catch(e) {
                console.warn('Failed to load Foliate CSS template, using fallback');
                return null;
            }
        }

        /**
         * Update reader settings and apply theme
         * Uses renderer.setStyles() for CSS injection
         */
        window._engineUpdateSettings = async function() {
            if (!window.foliateView) return;

            // --- SAVE SETTINGS SILENTLY ON CHANGE ---
            window.saveReaderSettings();

            const theme = document.getElementById('set-reader-theme').value;
            const fontSize = document.getElementById('set-font').value + 'px';
            const lineHeight = document.getElementById('set-line').value;
            const paraSpacing = document.getElementById('set-para-spacing').value + 'em';
            const indent = document.getElementById('set-indent').value + 'em';
            const fontFamily = document.getElementById('set-font-family').value;

            if(document.getElementById('val-font')) document.getElementById('val-font').innerText = fontSize;
            if(document.getElementById('val-line')) document.getElementById('val-line').innerText = lineHeight;
            if(document.getElementById('val-para-spacing')) document.getElementById('val-para-spacing').innerText = paraSpacing;
            if(document.getElementById('val-indent')) document.getElementById('val-indent').innerText = indent;

            // Dynamic Background Theming using shared helper
            const { bgColor, color } = window.getThemeColors(theme);

            document.getElementById('reader-container').style.backgroundColor = bgColor;
            viewerContainer.style.backgroundColor = bgColor;

            const currentReadMode = document.getElementById('set-read-mode').value;
            const currentLayout = (currentReadMode === 'continuous' || currentReadMode === 'scrolled') ? 'scrolled' : 'paginated';
            if (window.foliateView.renderer) window.foliateView.renderer.setAttribute('flow', currentLayout);

            // Get text align from active button - support ALL options (left, center, right, justify)
            const activeAlignBtn = document.querySelector('.segment-btn.active');
            let alignValue = 'left'; // default
            
            if (activeAlignBtn) {
                // First try data-align attribute, then fallback to ID-based detection
                if (activeAlignBtn.dataset && activeAlignBtn.dataset.align) {
                    alignValue = activeAlignBtn.dataset.align;
                } else if (activeAlignBtn.id) {
                    // Fallback: extract from ID (e.g., "align-center" -> "center")
                    const match = activeAlignBtn.id.match(/align-(.+)/);
                    if (match) alignValue = match[1];
                }
            }

            // Load CSS template from external file
            const cssTemplate = await loadFoliateCSSTemplate();
            
            if (cssTemplate) {
                // Combine the CSS template with custom property definitions
                // This ensures both the base styles and variable values are set together
                const fullCSS = cssTemplate + '\n:root {\n' +
                    `    --bg-color: ${bgColor};\n` +
                    `    --text-color: ${color};\n` +
                    `    --font-family: ${fontFamily};\n` +
                    `    --font-size: ${fontSize};\n` +
                    `    --line-height: ${lineHeight};\n` +
                    `    --text-align: ${alignValue};\n` +
                    `    --para-spacing: ${paraSpacing};\n` +
                    `    --indent: ${indent};\n` +
                    `}\n`;
                
                if (window.foliateView.renderer && typeof window.foliateView.renderer.setStyles === 'function') {
                    try {
                        window.foliateView.renderer.setStyles(fullCSS);
                    } catch(e) {
                        console.warn("Foliate setStyles failed:", e);
                    }
                }
            } else {
                // Fallback: use inline CSS if template loading failed
                const fallbackCSS = `
                    @namespace epub "http://www.idpf.org/2007/ops";
                    
                    html, body {
                        background: ${bgColor} !important;
                        color: ${color} !important;
                        font-family: ${fontFamily} !important;
                        font-size: ${fontSize} !important;
                        line-height: ${lineHeight} !important;
                        text-align: ${alignValue} !important;
                        cursor: pointer !important;
                        -webkit-tap-highlight-color: transparent;
                        margin: 0 !important;
                        padding: 20px !important;
                    }
                    
                    /* Apply to all text elements for better coverage */
                    p, div, span, li, td, th, blockquote, pre, code {
                        line-height: ${lineHeight} !important;
                        text-align: ${alignValue} !important;
                    }
                    
                    /* Headings should also respect the settings */
                    h1, h2, h3, h4, h5, h6 {
                        line-height: ${lineHeight} !important;
                        text-align: ${alignValue} !important;
                    }
                    
                    /* Paragraph specific styles */
                    p {
                        margin-bottom: ${paraSpacing} !important;
                        text-indent: ${indent} !important;
                    }
                    
                    /* EPUB-specific elements */
                    [epub|type] {
                        line-height: ${lineHeight} !important;
                        text-align: ${alignValue} !important;
                    }
                    
                    /* Prevent inheritance issues */
                    * {
                        line-height: inherit !important;
                    }
                `;
                
                if (window.foliateView.renderer && typeof window.foliateView.renderer.setStyles === 'function') {
                    try {
                        window.foliateView.renderer.setStyles(fallbackCSS);
                    } catch(e) {
                        console.warn("Foliate setStyles failed:", e);
                    }
                }
            }

            // Sync Floating Button Settings
            const showFloatCheckbox = document.getElementById('set-show-float-btn');
            const taskbarElement = document.getElementById('bottom-taskbar');
            
            if (window.taskbarToggleBtn) {
                if (showFloatCheckbox && !showFloatCheckbox.checked) {
                    window.taskbarToggleBtn.style.display = 'none';
                } else {
                    window.taskbarToggleBtn.style.display = 'flex';
                    if (taskbarElement) {
                        const taskbarCSS = window.getComputedStyle(taskbarElement);
                        window.taskbarToggleBtn.style.backgroundColor = taskbarCSS.backgroundColor;
                        window.taskbarToggleBtn.style.color = taskbarCSS.color;
                        window.taskbarToggleBtn.style.borderColor = taskbarCSS.borderTopColor !== 'rgba(0, 0, 0, 0)' ? taskbarCSS.borderTopColor : '#3f3f46';
                    }
                }
            }
        };

        const blob = new Blob([actualBuffer], { type: 'application/epub+zip' });
        const file = new File([blob], "book.epub", { type: 'application/epub+zip' });
        
        try {
            await window.foliateView.open(file);
        } catch (openErr) {
            throw new Error("Foliate failed to parse this EPUB file.");
        }
        
        document.getElementById('chapter-title').innerText = "Reading...";

        // Foliate-specific: builds TOC from foliateView.book.toc
        const tocList = document.getElementById('toc-list');
        tocList.innerHTML = '';
        if (window.foliateView.book.toc && typeof window.foliateView.book.toc.forEach === 'function') {
            window.foliateView.book.toc.forEach(chapter => {
                const li = document.createElement('li');
                li.className = 'list-item foliate-toc-item';
                li.innerText = chapter.label;
                li.dataset.href = chapter.href; 
                li.style.paddingLeft = '15px'; 
                
                li.onclick = () => { window.foliateView.goTo(chapter.href); if (window.closeAllModals) window.closeAllModals(); };
                tocList.appendChild(li);
            });
        }

        // Foliate-specific: uses addEventListener('relocate') with loc.tocItem
        window.foliateView.addEventListener('relocate', (e) => {
            const loc = e.detail;
            window.foliateCurrentCfi = loc.cfi;
            localStorage.setItem('bookmark-' + bookId, loc.cfi);
            
            let chapterName = "Reading...";
            let currentHref = loc.href || null;
            
            if (loc.tocItem) { if (loc.tocItem.label) chapterName = loc.tocItem.label; if (loc.tocItem.href) currentHref = loc.tocItem.href; }
            document.getElementById('chapter-title').innerText = chapterName;
            localStorage.setItem('progress-' + bookId, JSON.stringify({ chapter: chapterName, percentage: loc.fraction || 0 }));
            
            const targetPath = currentHref ? decodeURIComponent(currentHref.split('#')[0].replace(/^\//, '')) : null;
            document.querySelectorAll('#toc-list .list-item').forEach(li => {
                const itemPath = li.dataset.href ? decodeURIComponent(li.dataset.href.split('#')[0].replace(/^\//, '')) : null;
                if (itemPath && targetPath && itemPath === targetPath) {
                    li.style.color = 'var(--accent)'; li.style.fontWeight = 'bold'; li.style.borderLeft = '3px solid var(--accent)'; 
                    li.style.paddingLeft = '25px'; 
                    li.id = "active-toc-item"; 
                } else {
                    li.style.color = ''; li.style.fontWeight = 'normal'; li.style.borderLeft = 'none'; 
                    li.style.paddingLeft = '15px'; 
                    if (li.id === "active-toc-item") li.removeAttribute('id');
                }
            });
        });

        // Foliate-specific: click handler on foliateView
        window.foliateView.addEventListener('click', (e) => {
            const detail = e.detail || {};
            const target = detail.target || e.target;
            if (target && target.tagName && target.tagName.toLowerCase() === 'a') return;
            
            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');
            if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) taskbar.classList.toggle('hidden');
        });

        // Foliate-specific: touch events registered on 'load' event
        window.foliateView.addEventListener('load', (e) => {
            const innerDoc = e.detail.doc;
            if (!innerDoc) return;
            
            let touchStartX = 0; let touchStartY = 0; let touchStartTime = 0;
            
            innerDoc.addEventListener('touchstart', (ev) => {
                touchStartX = ev.changedTouches[0].screenX;
                touchStartY = ev.changedTouches[0].screenY;
                touchStartTime = Date.now();
            }, { passive: true });

            innerDoc.addEventListener('touchend', (ev) => {
                const endX = ev.changedTouches[0].screenX;
                const endY = ev.changedTouches[0].screenY;
                const timeTaken = Date.now() - touchStartTime;
                const dx = Math.abs(endX - touchStartX);
                const dy = Math.abs(endY - touchStartY);
                
                if (timeTaken < 300 && dx < 10 && dy < 10) {
                    if (ev.target && ev.target.closest && ev.target.closest('a')) return;
                    try { if (innerDoc.defaultView.getSelection().toString().length > 0) return; } catch(err) {}
                    
                    const taskbar = document.getElementById('bottom-taskbar');
                    const pinCheckbox = document.getElementById('set-pin-taskbar');
                    if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) {
                        taskbar.classList.toggle('hidden');
                        ev.stopPropagation(); 
                    }
                }
            }, { passive: true });
        });

        // Create floating taskbar toggle button
        if (document.getElementById('taskbar-toggle-btn')) document.getElementById('taskbar-toggle-btn').remove();
        
        const btn = document.createElement('button');
        btn.id = 'taskbar-toggle-btn';
        btn.innerHTML = '<i class="ph ph-caret-down"></i>';
        
        Object.assign(btn.style, {
            position: 'fixed', bottom: '75px', right: '20px', zIndex: '9999', width: '40px', height: '40px', borderRadius: '50%',
            border: '1px solid var(--border, #3f3f46)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)', transition: 'bottom 0.3s ease, background-color 0.2s ease', fontSize: '20px'
        });
        
        document.getElementById('reader-container').appendChild(btn);
        window.taskbarToggleBtn = btn;
        
        const taskbar = document.getElementById('bottom-taskbar');
        
        if (window.taskbarObserver) window.taskbarObserver.disconnect();
        window.taskbarObserver = new MutationObserver(() => {
            if (taskbar.classList.contains('hidden')) { btn.style.bottom = '20px'; btn.innerHTML = '<i class="ph ph-caret-up"></i>'; } 
            else { btn.style.bottom = '75px'; btn.innerHTML = '<i class="ph ph-caret-down"></i>'; }
        });
        if (taskbar) {
            window.taskbarObserver.observe(taskbar, { attributes: true, attributeFilter: ['class'] });
            if (taskbar.classList.contains('hidden')) { btn.style.bottom = '20px'; btn.innerHTML = '<i class="ph ph-caret-up"></i>'; }
        }
        
        btn.onclick = (e) => { e.stopPropagation(); if (taskbar) taskbar.classList.toggle('hidden'); };

        window._engineUpdateSettings();
        
        // Restore bookmark with setTimeout fallback
        const savedLocation = localStorage.getItem('bookmark-' + bookId);
        
        setTimeout(async () => {
            try {
                if (savedLocation && typeof savedLocation === 'string' && savedLocation.length > 0) {
                    await window.foliateView.goTo(savedLocation);
                } else {
                    if (window.foliateView.book && window.foliateView.book.toc && window.foliateView.book.toc.length > 0) {
                        await window.foliateView.goTo(window.foliateView.book.toc[0].href);
                    }
                }
            } catch (err) {
                console.warn("Foliate Navigation Error. Wiping bad bookmark and falling back to start.", err);
                localStorage.removeItem('bookmark-' + bookId);
                
                try {
                    if (window.foliateView.book && window.foliateView.book.toc && window.foliateView.book.toc.length > 0) {
                        await window.foliateView.goTo(window.foliateView.book.toc[0].href);
                    }
                } catch (fallbackErr) {
                    console.error("Total failure opening book.", fallbackErr);
                }
            }
        }, 150);
        
    } catch (error) {
        console.error("Foliate Engine Error:", error);
        throw error; 
    }
};

/**
 * Destroy Foliate.js engine and clean up resources
 */
window.destroyFoliateEngine = function() {
    if (window.foliateView) { window.foliateView.remove(); window.foliateView = null; window.foliateCurrentCfi = null; window.rendition = null; }
    if (window.taskbarToggleBtn) { window.taskbarToggleBtn.remove(); window.taskbarToggleBtn = null; }
    if (window.taskbarObserver) { window.taskbarObserver.disconnect(); }
};

/**
 * Search across all sections using Foliate's section.createDocument()
 */
window.runGlobalSearch = async function() {
    if (!window.foliateView || !window.foliateView.book) return alert("Search is currently not available. Please wait for the book to finish loading.");
    const query = document.getElementById('global-search-input').value;
    if (!query) return;
    
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="padding:10px;">Searching...</div>';
    
    try {
        const book = window.foliateView.book;
        const sections = book.sections || [];
        
        const searchPromises = sections.map(async (section) => {
            try {
                let text = "";
                if (typeof section.createDocument === 'function') {
                    const doc = await section.createDocument();
                    text = doc.body ? doc.body.textContent : "";
                } else if (typeof book.load === 'function') {
                    const content = await book.load(section.href || section.id);
                    if (typeof content === 'string') {
                        const doc = new DOMParser().parseFromString(content, "text/html");
                        text = doc.body ? doc.body.textContent : content.replace(/<[^>]+>/g, '');
                    } else if (content instanceof Blob) {
                        const str = await content.text();
                        const doc = new DOMParser().parseFromString(str, "text/html");
                        text = doc.body ? doc.body.textContent : str.replace(/<[^>]+>/g, '');
                    } else if (content instanceof Document) {
                        text = content.body ? content.body.textContent : "";
                    }
                }
                
                const rawHref = section.href || section.idref || section.id || "Unknown File";
                const fileName = decodeURIComponent(rawHref.split('/').pop().split('#')[0]);
                let chapterLabel = fileName !== "Unknown File" ? fileName : "Unknown Chapter";
                
                if (book.toc && book.toc.length > 0) {
                    const findInToc = (items) => {
                        for (let t of items) {
                            if (t.href && decodeURIComponent(t.href).includes(fileName)) return t.label ? t.label.trim() : null;
                            if (t.subitems) { let sub = findInToc(t.subitems); if (sub) return sub; }
                        }
                        return null;
                    };
                    let foundLabel = findInToc(book.toc);
                    if (foundLabel) chapterLabel = foundLabel;
                }
                
                const sectionMatches = [];
                if (text) {
                    let regex = new RegExp(query, "gi");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const snippet = text.substring(Math.max(0, match.index - 30), match.index + query.length + 30);
                        sectionMatches.push({ 
                            href: section.href || section.id,
                            snippet: snippet,
                            chapter: chapterLabel,
                            file: fileName
                        });
                    }
                }
                return sectionMatches;
            } catch(err) {
                console.warn("Skipped section during search", err);
                return [];
            }
        });
        
        const results = await Promise.all(searchPromises);
        const allMatches = results.flat();
        
        resultsContainer.innerHTML = '';
        if (allMatches.length === 0) return resultsContainer.innerHTML = '<div style="padding:10px;">No results found.</div>';
        
        allMatches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `
                <div style="font-weight: 600; color: var(--accent); margin-bottom: 4px; font-size: 13px;">
                    ${match.chapter} <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">(${match.file})</span>
                </div>
                <span style="font-size: 13px;">...${match.snippet.replace(new RegExp(query, 'gi'), m => `<strong style="color:var(--accent); background:rgba(59,130,246,0.2); padding:0 2px; border-radius:3px;">${m}</strong>`)}...</span>
            `;
            li.onclick = () => { 
                window.foliateView.goTo(match.href); 
                if (window.closeAllModals) window.closeAllModals(); 
            };
            resultsContainer.appendChild(li);
        });
    } catch (e) { 
        resultsContainer.innerHTML = '<div style="padding:10px; color:red;">Search failed.</div>'; 
        console.error("Search error:", e);
    }
};
