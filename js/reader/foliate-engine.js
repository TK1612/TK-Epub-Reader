// Load Foliate.js dynamically for iOS compatibility
(function loadFoliateScript() {
    // Check if customElements is supported
    if (typeof customElements === 'undefined') {
        console.error('Custom Elements API not supported in this browser');
        window._foliateLoadError = 'Custom Elements API not supported';
        return;
    }
    
    // Check if already loaded
    if (customElements.get('foliate-view')) {
        console.log('Foliate.js already loaded');
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/johnfactotum/foliate-js@main/view.js';
    script.async = true;
    
    script.onload = function() {
        console.log('Foliate.js script loaded successfully');
        window._foliateLoaded = true;
    };
    
    script.onerror = function() {
        console.error('Failed to load Foliate.js from CDN');
        window._foliateLoadError = 'Failed to load Foliate.js from CDN';
    };
    
    document.head.appendChild(script);
})();

window.foliateView = null;
window.foliateCurrentCfi = null;
window.taskbarToggleBtn = null;

/**
 * Wait for Foliate custom element to be defined with timeout
 * @param {number} timeoutMs - Timeout in milliseconds (default 10000 = 10 seconds)
 * @returns {Promise<void>}
 */
function waitForFoliateDefinition(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        // Check if already defined
        if (customElements.get('foliate-view')) {
            resolve();
            return;
        }
        
        // Check if there was a load error
        if (window._foliateLoadError) {
            reject(new Error(window._foliateLoadError));
            return;
        }
        
        let timeoutId;
        const observer = new MutationObserver(() => {
            if (customElements.get('foliate-view')) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve();
            }
        });
        
        // Set timeout
        timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Timeout waiting for Foliate.js to load (10s)'));
        }, timeoutMs);
        
        // Start observing
        customElements.addEventListener('whenDefined', (e) => {
            if (e.detail && e.detail.name === 'foliate-view') {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve();
            }
        });
        
        // Also try the standard way
        customElements.whenDefined('foliate-view').then(() => {
            clearTimeout(timeoutId);
            observer.disconnect();
            resolve();
        }).catch(reject);
    });
}

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
        
        // Wait for foliate-view to be defined with timeout
        try {
            await waitForFoliateDefinition(10000);
        } catch (err) {
            throw new Error("Foliate.js failed to load: " + err.message + ". Try using EPUB.js engine instead.");
        }
        
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
            if (window.foliateView.renderer) {
                window.foliateView.renderer.setAttribute('flow', currentLayout);
            }

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
                        padding: 16px !important;
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
                const deltaX = endX - touchStartX;
                const deltaY = Math.abs(endY - touchStartY);
                const deltaTime = Date.now() - touchStartTime;

                if (Math.abs(deltaX) > 50 && deltaY < 50 && deltaTime < 500) {
                    if (deltaX < 0) { if(window.foliateView) window.foliateView.next(); }
                    else { if(window.foliateView) window.foliateView.prev(); }
                }
            }, { passive: true });
        });

        // Apply initial settings
        if (window._engineUpdateSettings) window._engineUpdateSettings();

    } catch (error) {
        console.error("Foliate engine error:", error);
        throw error;
    }
};

window.destroyFoliateEngine = function() {
    if (window.foliateView) {
        try {
            window.foliateView.remove();
        } catch(e) {}
        window.foliateView = null;
    }
    window.foliateCurrentCfi = null;
    window.rendition = null;
};
