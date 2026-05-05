// js/reader/epub-engine.js

window.book = null;
window.rendition = null;
window.taskbarToggleBtn = null;

window.launchEpubJsEngine = async function(bookId) {
    // --- LOAD SETTINGS BEFORE ENGINE BOOTS ---
    try {
        const saved = JSON.parse(localStorage.getItem('reader-settings'));
        if (saved) {
            if(saved.theme && document.getElementById('set-reader-theme')) document.getElementById('set-reader-theme').value = saved.theme;
            if(saved.fontSize && document.getElementById('set-font')) document.getElementById('set-font').value = saved.fontSize;
            if(saved.lineHeight && document.getElementById('set-line')) document.getElementById('set-line').value = saved.lineHeight;
            if(saved.paraSpacing !== undefined && document.getElementById('set-para-spacing')) document.getElementById('set-para-spacing').value = saved.paraSpacing;
            if(saved.indent !== undefined && document.getElementById('set-indent')) document.getElementById('set-indent').value = saved.indent;
            if(saved.fontFamily && document.getElementById('set-font-family')) document.getElementById('set-font-family').value = saved.fontFamily;
            if(saved.textColor && document.getElementById('set-text-color')) document.getElementById('set-text-color').value = saved.textColor;
            if(saved.readMode && document.getElementById('set-read-mode')) document.getElementById('set-read-mode').value = saved.readMode;
            if(saved.pinTaskbar !== undefined && document.getElementById('set-pin-taskbar')) document.getElementById('set-pin-taskbar').checked = saved.pinTaskbar;
            if(saved.showFloatBtn !== undefined && document.getElementById('set-show-float-btn')) document.getElementById('set-show-float-btn').checked = saved.showFloatBtn;
            if(saved.textAlign) {
                document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
                const alignBtn = document.getElementById('align-' + saved.textAlign);
                if (alignBtn) alignBtn.classList.add('active');
            }
        }
    } catch(e) {}

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

    const bookData = await localforage.getItem(bookId);
    if (!bookData) throw new Error("Could not retrieve book from database.");
    
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

        // --- SAVE SETTINGS SILENTLY ON CHANGE ---
        try {
            const alignBtn = document.querySelector('.segment-btn.active');
            const settings = {
                theme: document.getElementById('set-reader-theme') ? document.getElementById('set-reader-theme').value : 'black',
                fontSize: document.getElementById('set-font') ? document.getElementById('set-font').value : '18',
                lineHeight: document.getElementById('set-line') ? document.getElementById('set-line').value : '1.5',
                paraSpacing: document.getElementById('set-para-spacing') ? document.getElementById('set-para-spacing').value : '0',
                indent: document.getElementById('set-indent') ? document.getElementById('set-indent').value : '0',
                fontFamily: document.getElementById('set-font-family') ? document.getElementById('set-font-family').value : 'Inter',
                textColor: document.getElementById('set-text-color') ? document.getElementById('set-text-color').value : '#e4e4e7',
                readMode: document.getElementById('set-read-mode') ? document.getElementById('set-read-mode').value : 'paginated',
                pinTaskbar: document.getElementById('set-pin-taskbar') ? document.getElementById('set-pin-taskbar').checked : false,
                showFloatBtn: document.getElementById('set-show-float-btn') ? document.getElementById('set-show-float-btn').checked : true,
                textAlign: alignBtn ? (alignBtn.id === 'align-center' ? 'center' : 'left') : 'left'
            };
            localStorage.setItem('reader-settings', JSON.stringify(settings));
        } catch(e) {}

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

        // Dynamic Background Theming 
        let bgColor = '#18181b'; let color = textColor;
        if (theme === 'light') { bgColor = '#ffffff'; color = textColor === '#e4e4e7' ? '#000000' : textColor; }
        else if (theme === 'paper') { bgColor = '#f4ecd8'; color = textColor === '#e4e4e7' ? '#333333' : textColor; }
        else if (theme === 'blue' || theme === 'light-blue') { bgColor = '#e8f4f8'; color = textColor === '#e4e4e7' ? '#1a365d' : textColor; }
        else if (theme === 'black') { bgColor = '#000000'; color = textColor; } 
        else if (theme === 'dark') { bgColor = '#18181b'; color = textColor; } 
        
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
            const spineItem = window.book.spine.get(location.start.cfi);
            const baseHref = spineItem ? spineItem.href : currentHref;
            const cleanBaseFileName = decodeURIComponent(baseHref.split('#')[0].split('/').pop());
            const cleanCurrentFileName = decodeURIComponent(currentHref.split('#')[0].split('/').pop());

            if (window.book.navigation && window.book.navigation.toc) {
                let matchedItem = null;
                const findInToc = (items) => {
                    for (let item of items) {
                        const cleanItemFileName = decodeURIComponent(item.href.split('#')[0].split('/').pop());
                        if (cleanItemFileName === cleanBaseFileName || cleanItemFileName === cleanCurrentFileName) {
                            matchedItem = item;
                            return;
                        }
                        if (item.subitems && item.subitems.length > 0) findInToc(item.subitems);
                    }
                };
                findInToc(window.book.navigation.toc);
                
                if (matchedItem) {
                    chapterName = matchedItem.label.trim();
                    currentHref = matchedItem.href;
                }
            }
        } catch(e) {}

        document.getElementById('chapter-title').innerText = chapterName;
        
        if (window.book.locations && window.book.locations.length) {
            const percentage = window.book.locations.percentageFromCfi(location.start.cfi);
            localStorage.setItem('progress-' + bookId, JSON.stringify({ chapter: chapterName, percentage: percentage }));
        }

        const targetFileName = currentHref ? decodeURIComponent(currentHref.split('#')[0].split('/').pop()) : null;

        document.querySelectorAll('#toc-list .list-item').forEach(li => {
            const itemFileName = li.dataset.href ? decodeURIComponent(li.dataset.href.split('#')[0].split('/').pop()) : null;
            
            if (itemFileName && targetFileName && itemFileName === targetFileName) {
                li.style.color = 'var(--accent)'; 
                li.style.fontWeight = 'bold'; 
                li.style.borderLeft = '3px solid var(--accent)'; 
                li.style.paddingLeft = '10px'; 
                li.id = "active-toc-item"; 
            } else {
                li.style.color = ''; 
                li.style.fontWeight = 'normal'; 
                li.style.borderLeft = 'none'; 
                li.style.paddingLeft = li.dataset.originalPadding || '15px'; 
                if (li.id === "active-toc-item") li.removeAttribute('id');
            }
        });
    });

    window.book.ready.then(() => {
        return window.book.locations.generate(1600);
    }).catch(err => {});

    window.book.loaded.navigation.then(function(nav) {
        const tocList = document.getElementById('toc-list');
        if (!tocList || !nav) return;
        tocList.innerHTML = '';
        
        const tocItems = nav.toc || nav; 
        
        const buildToc = (items, depth = 0) => {
            if (!items || typeof items.forEach !== 'function') return;
            items.forEach(chapter => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerText = chapter.label ? chapter.label.trim() : "Chapter";
                li.dataset.href = chapter.href; 
                
                const padding = (15 + (depth * 15)) + 'px';
                li.style.paddingLeft = padding;
                li.dataset.originalPadding = padding; 
                
                // 3-TIER SMART ROUTER
                li.onclick = () => { 
                    const targetHref = chapter.href;
                    window.rendition.display(targetHref).catch(() => {
                        const cleanHref = targetHref.split('#')[0];
                        window.rendition.display(cleanHref).catch(() => {
                            const fileName = cleanHref.split('/').pop();
                            if (window.book && window.book.spine && window.book.spine.spineItems) {
                                const spineItem = window.book.spine.spineItems.find(item => decodeURIComponent(item.href.split('/').pop()) === decodeURIComponent(fileName));
                                if (spineItem) {
                                    window.rendition.display(spineItem.href);
                                }
                            }
                        });
                    });
                    if (window.closeAllModals) window.closeAllModals(); 
                };

                tocList.appendChild(li);

                if (chapter.subitems && chapter.subitems.length > 0) {
                    buildToc(chapter.subitems, depth + 1);
                }
            });
        };

        try {
            buildToc(tocItems);
        } catch(err) {
            console.warn("Could not build standard TOC list", err);
        }
    }).catch(err => console.warn("TOC loading failed", err));

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

    // Mobile Touch Logic
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

// --- FIX: ULTRA-FAST SEARCH WITH BULLETPROOF JUMPING ---
window.runGlobalSearch = async function() {
    if (!window.book) return alert("Search is currently only available when a book is loaded.");
    const query = document.getElementById('global-search-input').value;
    if (!query) return;
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="padding:10px;">Searching...</div>';
    
    try {
        // FIX 1: Ensures the book is fully unpacked before reading files. 
        // If you hit search too quickly, JSZip gets locked and hangs forever!
        await window.book.ready;

        // Runs all chapters simultaneously (Lightning Fast)
        const searchPromises = window.book.spine.spineItems.map(async (item) => {
            try {
                const doc = await item.load(window.book.load.bind(window.book));
                const text = doc.body ? doc.body.textContent : "";
                
                const rawHref = item.href || "Unknown File";
                const fileName = decodeURIComponent(rawHref.split('/').pop().split('#')[0]);
                let chapterLabel = fileName !== "Unknown File" ? fileName : "Unknown Chapter";
                
                if (window.book.navigation && window.book.navigation.toc) {
                    const findInToc = (items) => {
                        for (let t of items) {
                            if (t.href && decodeURIComponent(t.href).includes(fileName)) return t.label ? t.label.trim() : null;
                            if (t.subitems) { let sub = findInToc(t.subitems); if (sub) return sub; }
                        }
                        return null;
                    };
                    let foundLabel = findInToc(window.book.navigation.toc);
                    if (foundLabel) chapterLabel = foundLabel;
                }

                const sectionMatches = [];
                if (text) {
                    let regex = new RegExp(query, "gi");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const snippet = text.substring(Math.max(0, match.index - 30), match.index + query.length + 30);
                        sectionMatches.push({ 
                            href: item.href, 
                            cfiBase: item.cfiBase, // Capture the secure exact chapter ID
                            snippet: snippet,
                            chapter: chapterLabel,
                            file: fileName
                        });
                    }
                }
                item.unload();
                return sectionMatches;
            } catch(e) {
                console.warn("Skipped section during search", e);
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
                // FIX 2: 3-Tier Navigation Router. Tries the secure CFI first, then falls back to file paths
                const target = match.cfiBase || match.href;
                window.rendition.display(target).catch(() => {
                    window.rendition.display(match.href).catch(() => {
                        if (window.book && window.book.spine && window.book.spine.spineItems) {
                            const spineItem = window.book.spine.spineItems.find(item => decodeURIComponent(item.href.split('/').pop()) === decodeURIComponent(match.file));
                            if (spineItem) window.rendition.display(spineItem.href);
                        }
                    });
                });
                if (window.closeAllModals) window.closeAllModals(); 
            };
            resultsContainer.appendChild(li);
        });
    } catch (e) { 
        resultsContainer.innerHTML = '<div style="padding:10px; color:red;">Search failed.</div>'; 
        console.error("Search Error:", e);
    }
};
