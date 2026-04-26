// js/reader/epub-engine.js

window.book = null;
window.rendition = null;
window.taskbarToggleBtn = null;

window.launchEpubJsEngine = async function(bookId) {
    const bookData = await localforage.getItem(bookId);
    if (!bookData) throw new Error("Could not retrieve book from database.");
    
    // Safely unwrap the ArrayBuffer to prevent crashes
    const actualBuffer = bookData.buffer || bookData; 
    if (!actualBuffer || actualBuffer.byteLength === 0) throw new Error("Book file is empty or corrupted.");

    window.book = ePub(actualBuffer);
    const viewer = document.getElementById('viewer');
    viewer.innerHTML = '';

    const readMode = document.getElementById('set-read-mode').value || 'paginated';
    const isContinuous = (readMode === 'continuous');

    window.rendition = window.book.renderTo(viewer, {
        manager: isContinuous ? "continuous" : "default",
        flow: isContinuous ? "scrolled" : (readMode === 'scrolled' ? "scrolled" : "paginated"),
        width: "100%",
        height: "100%",
        snap: !isContinuous 
    });

    window.updateSettings = function() {
        if (!window.rendition) return;

        const theme = document.getElementById('set-reader-theme').value;
        const fontSize = document.getElementById('set-font').value + 'px';
        const lineHeight = document.getElementById('set-line').value;
        const paraSpacing = document.getElementById('set-para-spacing').value + 'em';
        const indent = document.getElementById('set-indent').value + 'em';
        const fontFamily = document.getElementById('set-font-family').value;
        const textColor = document.getElementById('set-text-color').value;
        const alignBtn = document.querySelector('.segment-btn.active');
        const textAlign = alignBtn ? (alignBtn.id === 'align-center' ? 'center' : 'left') : 'left';

        if(document.getElementById('val-font')) document.getElementById('val-font').innerText = fontSize;
        if(document.getElementById('val-line')) document.getElementById('val-line').innerText = lineHeight;
        if(document.getElementById('val-para-spacing')) document.getElementById('val-para-spacing').innerText = paraSpacing;
        if(document.getElementById('val-indent')) document.getElementById('val-indent').innerText = indent;

        // Dynamic Background Theming (Supports Light, Paper, Blue, Dark, and Pure Black)
        let bgColor = '#18181b'; let color = textColor;
        if (theme === 'light') { bgColor = '#ffffff'; color = textColor === '#e4e4e7' ? '#000000' : textColor; }
        else if (theme === 'paper') { bgColor = '#f4ecd8'; color = textColor === '#e4e4e7' ? '#333333' : textColor; }
        else if (theme === 'blue' || theme === 'light-blue') { bgColor = '#e8f4f8'; color = textColor === '#e4e4e7' ? '#1a365d' : textColor; }
        else if (theme === 'black') { bgColor = '#000000'; color = textColor; } 
        
        document.getElementById('reader-container').style.backgroundColor = bgColor;
        viewer.style.backgroundColor = bgColor;

        window.rendition.themes.register("custom", {
            "body": { "background": bgColor + " !important", "color": color + " !important", "font-family": fontFamily + " !important", "font-size": fontSize + " !important", "line-height": lineHeight + " !important", "text-align": textAlign + " !important" },
            "p": { "margin-bottom": paraSpacing + " !important", "text-indent": indent + " !important" }
        });
        window.rendition.themes.select("custom");

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

    window.updateSettings(); 

    // Bulletproof Load Sequence
    const savedLocation = localStorage.getItem('bookmark-' + bookId);
    try {
        if (savedLocation) {
            await window.rendition.display(savedLocation);
        } else {
            await window.rendition.display();
        }
        document.getElementById('chapter-title').innerText = "Reading...";
    } catch (err) {
        console.warn("Bookmark rendering failed. Forcing spine fallback.", err);
        localStorage.removeItem('bookmark-' + bookId); 
        try {
            if (window.book.spine && window.book.spine.first()) {
                await window.rendition.display(window.book.spine.first().href);
            } else {
                await window.rendition.display();
            }
            document.getElementById('chapter-title').innerText = "Reading...";
        } catch (fallbackErr) {
            throw new Error("EPUB.js could not parse the internal structure of this novel.");
        }
    }

    // Bookmarks and Active TOC Highlighting
    window.rendition.on("relocated", function(location) {
        localStorage.setItem('bookmark-' + bookId, location.start.cfi);
        
        let chapterName = "Chapter";
        let currentHref = location.start.href;

        try {
            const toc = window.book.navigation ? window.book.navigation.get(currentHref) : null;
            if (toc) {
                if (toc.label) chapterName = toc.label;
                if (toc.href) currentHref = toc.href;
            }
        } catch(e) {}

        document.getElementById('chapter-title').innerText = chapterName;
        
        if (window.book.locations && window.book.locations.length) {
            const percentage = window.book.locations.percentageFromCfi(location.start.cfi);
            localStorage.setItem('progress-' + bookId, JSON.stringify({ chapter: chapterName, percentage: percentage }));
        }

        const targetPath = currentHref ? currentHref.split('#')[0].replace(/^\//, '') : null;

        document.querySelectorAll('#toc-list .list-item').forEach(li => {
            const itemPath = li.dataset.href ? li.dataset.href.split('#')[0].replace(/^\//, '') : null;
            if (itemPath && targetPath && itemPath === targetPath) {
                li.style.color = 'var(--accent)'; 
                li.style.fontWeight = 'bold'; 
                li.style.borderLeft = '3px solid var(--accent)'; 
                li.style.paddingLeft = '10px'; 
                li.id = "active-toc-item"; 
            } else {
                li.style.color = ''; 
                li.style.fontWeight = 'normal'; 
                li.style.borderLeft = 'none'; 
                li.style.paddingLeft = '0px'; 
                if (li.id === "active-toc-item") li.removeAttribute('id');
            }
        });
    });

    // Suppress generation crashes gracefully
    window.book.ready.then(() => {
        return window.book.locations.generate(1600);
    }).catch(err => {
        console.warn("Locations generation skipped due to non-standard EPUB HTML.");
    });

    // Build the TOC safely
    window.book.loaded.navigation.then(function(toc) {
        const tocList = document.getElementById('toc-list');
        if (!tocList || !toc) return;
        tocList.innerHTML = '';
        
        try {
            toc.forEach(function(chapter) {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerText = chapter.label;
                li.dataset.href = chapter.href; 
                li.style.paddingLeft = '15px';
                li.onclick = () => { 
                    window.rendition.display(chapter.href); 
                    if (window.closeAllModals) window.closeAllModals(); 
                };
                tocList.appendChild(li);
            });
        } catch(err) {
            console.warn("Could not build standard TOC list", err);
        }
    }).catch(err => console.warn("TOC loading failed", err));

    // --- UNIVERSAL FLOATING BUTTON SETUP ---
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

    // PC Click Handling
    window.rendition.on('click', (e) => {
        if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'a') return;
        try { if (window.rendition.getContents()[0].window.getSelection().toString().length > 0) return; } catch(err) {}

        const w = window.innerWidth;
        if (e.clientX > w * 0.25 && e.clientX < w * 0.75) {
            const pinCheckbox = document.getElementById('set-pin-taskbar');
            if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) taskbar.classList.toggle('hidden');
        }
    });

    // --- RESTORED WORKING MOBILE TOUCH LOGIC ---
    window.rendition.hooks.content.register(function(contents) {
        let startX = 0; let startY = 0; let startTime = 0;
        
        contents.document.addEventListener('touchstart', (event) => {
            startX = event.changedTouches[0].screenX; 
            startY = event.changedTouches[0].screenY; 
            startTime = new Date().getTime();
        }, { passive: true });

        contents.document.addEventListener('touchend', (event) => {
            const endX = event.changedTouches[0].screenX; 
            const endY = event.changedTouches[0].screenY;
            const timeTaken = new Date().getTime() - startTime;
            const deltaX = endX - startX; 
            const deltaY = endY - startY;
            
            const currentReadMode = document.getElementById('set-read-mode').value;
            const isPaginated = (currentReadMode === 'paginated');

            if (isPaginated && timeTaken < 300 && Math.abs(deltaX) > 40 && Math.abs(deltaY) < 40) {
                if (deltaX > 0) window.rendition.prev(); else window.rendition.next();
            } 
            else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                if (event.target && event.target.tagName && event.target.tagName.toLowerCase() !== 'a') {
                    try { if (contents.window.getSelection().toString().length > 0) return; } catch(err) {}
                    
                    // The secret: Trust lexical scope and skip the broken middle-screen math!
                    const taskbarEl = document.getElementById('bottom-taskbar');
                    const pinCheckbox = document.getElementById('set-pin-taskbar');
                    if (taskbarEl && (!pinCheckbox || !pinCheckbox.checked)) {
                        taskbarEl.classList.toggle('hidden');
                    }
                }
            }
        }, { passive: true });
    });
};

window.destroyEpubJsEngine = function() {
    if (window.book) { window.book.destroy(); window.book = null; window.rendition = null; }
    if (window.taskbarToggleBtn) { window.taskbarToggleBtn.remove(); window.taskbarToggleBtn = null; }
    if (window.taskbarObserver) { window.taskbarObserver.disconnect(); }
};

window.runGlobalSearch = async function() {
    if (!window.book) return alert("Search is currently only available on the EPUB.js engine.");
    const query = document.getElementById('global-search-input').value;
    if (!query) return;
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="padding:10px;">Searching...</div>';
    try {
        const results = await Promise.all(
            window.book.spine.spineItems.map(item => 
                item.load(window.book.load.bind(window.book)).then(doc => {
                    const text = doc.textContent || "";
                    const matches = [];
                    let regex = new RegExp(query, "gi");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const snippet = text.substring(Math.max(0, match.index - 30), match.index + query.length + 30);
                        matches.push({ cfi: item.cfiFromElement(match[0] ? match[0] : doc.body), snippet: snippet });
                    }
                    item.unload(); return matches;
                })
            )
        );
        const allMatches = results.flat();
        resultsContainer.innerHTML = '';
        if (allMatches.length === 0) return resultsContainer.innerHTML = '<div style="padding:10px;">No results found.</div>';
        allMatches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<span style="font-size: 13px;">...${match.snippet.replace(new RegExp(query, 'gi'), match => `<strong style="color:var(--accent);">${match}</strong>`)}...</span>`;
            li.onclick = () => { window.rendition.display(match.cfi); if (window.closeAllModals) window.closeAllModals(); };
            resultsContainer.appendChild(li);
        });
    } catch (e) { resultsContainer.innerHTML = '<div style="padding:10px; color:red;">Search failed.</div>'; }
};
