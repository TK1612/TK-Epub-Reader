window.openReader = async function(bookId, pushHistory = true) {
    if (pushHistory) {
        history.pushState({ view: 'reader', bookId: bookId }, '', '#reader');
    }
    
    window.currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(window.book) window.book.destroy();
    
    window.book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'block';
    
    let savedMode = localStorage.getItem('reader-mode');
    if (!savedMode) {
        const isPC = window.innerWidth > 768 && !(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
        savedMode = isPC ? 'continuous' : 'paginated';
        localStorage.setItem('reader-mode', savedMode);
    }
    document.getElementById('set-read-mode').value = savedMode;
    
    const pinTaskbar = localStorage.getItem('pin-taskbar') !== 'false';
    document.getElementById('set-pin-taskbar').checked = pinTaskbar;

    let renderOptions = { width: "100%", height: "100%", spread: "none" };
    
    if (savedMode === 'continuous') {
        renderOptions.manager = "continuous"; renderOptions.flow = "scrolled-doc";
    } else if (savedMode === 'scrolled') {
        renderOptions.manager = "default"; renderOptions.flow = "scrolled-doc";
    } else {
        renderOptions.manager = "default"; renderOptions.flow = "paginated";
    }
    
    window.rendition = window.book.renderTo("viewer", renderOptions);
    
    window.addEventListener("resize", () => {
        if (window.rendition) window.rendition.resize();
    });

    window.updateSettings();

    const highlightCurrentChapter = (href) => {
        let navItem = window.book.navigation.get(href);
        if (!navItem) {
            const findNavItem = (items) => {
                for (let item of items) {
                    let baseHref = item.href.split('#')[0];
                    if (baseHref === href || href.includes(baseHref)) return item;
                    if (item.subitems && item.subitems.length > 0) {
                        let subMatch = findNavItem(item.subitems);
                        if (subMatch) return subMatch;
                    }
                }
                return null;
            };
            navItem = findNavItem(window.book.navigation.toc);
        }

        document.querySelectorAll('#toc-list .list-item').forEach(li => {
            li.classList.remove('active-toc');
            if (navItem && (li.dataset.href === navItem.href || li.dataset.href.includes(navItem.href))) {
                li.classList.add('active-toc');
            }
        });
        return navItem;
    };

    const updateAndSaveProgress = (currentLocation, chapterLabel) => {
        let percent = 0;
        const oldStr = localStorage.getItem('progress-' + bookId);
        if (oldStr) { try { percent = JSON.parse(oldStr).percentage || 0; } catch(e){} }

        const isGenerated = window.book.locations && 
            ((typeof window.book.locations.length === 'function' && window.book.locations.length() > 0) || 
             window.book.locations.length > 0 || window.book.locations.total > 0);
        
        if (isGenerated && currentLocation && currentLocation.start && currentLocation.start.cfi) {
            try {
                let pFloat = window.book.locations.percentageFromCfi(currentLocation.start.cfi);
                if (pFloat !== null && pFloat >= 0 && pFloat <= 1) percent = Math.round(pFloat * 100);
            } catch(e) {}
        }

        localStorage.setItem('progress-' + bookId, JSON.stringify({ chapter: chapterLabel, percentage: percent }));
    };

    window.book.ready.then(() => {
        const savedCfi = localStorage.getItem('bookmark-' + bookId);
        const cachedLocations = localStorage.getItem('locations-' + bookId);
        
        if (cachedLocations) {
            try { window.book.locations.load(cachedLocations); } catch(e) {}
        }

        if (savedCfi) window.rendition.display(savedCfi);
        else window.rendition.display();
        // --- iOS PWA "CAPTURE PHASE" TOUCH FIX ---
        // By using { capture: true }, we intercept the touch BEFORE epub.js or Safari can swallow it!
        // --- iOS NATIVE-FEEL TOUCH & TAP SYSTEM ---
        // --- iOS NATIVE-FEEL TOUCH SYSTEM (WITH PAGINATION LOCKS) ---
        let isPaginating = false; // Prevents overlapping swipe crashes

        rendition.hooks.content.register(function(contents) {
            const body = contents.document.querySelector('body');
            let startX = 0;
            let startY = 0;
            let startTime = 0;

            body.addEventListener('touchstart', (e) => {
                startX = e.changedTouches[0].clientX;
                startY = e.changedTouches[0].clientY;
                startTime = Date.now();
            }, { passive: true });

            body.addEventListener('touchend', async (e) => {
                // 1. SAFETY LOCK: Ignore touches if the book is currently turning a page
                if (isPaginating) return;
                
                // 2. SAFETY LOCK: Ensure epub.js hasn't lost track of the location (Fixes your console error)
                if (!rendition || !rendition.location || !rendition.location.start) return;

                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const timeTaken = Date.now() - startTime;
                
                const deltaX = endX - startX;
                const deltaY = endY - startY;

                // Safeguard: Let the browser handle vertical scrolling
                if (Math.abs(deltaY) > 30) return;

                try {
                    // SWIPE LOGIC (Fast horizontal flick)
                    if (timeTaken < 400 && Math.abs(deltaX) > 50) {
                        isPaginating = true;
                        if (deltaX > 0) await rendition.prev();
                        else await rendition.next();
                        
                        setTimeout(() => { isPaginating = false; }, 150); // Release lock
                        return; 
                    } 
                    
                    // TAP LOGIC (Edge Taps for pages, Center Tap for menu)
                    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                        if (e.target.tagName.toLowerCase() === 'a') return;

                        const screenWidth = contents.window.innerWidth;
                        
                        if (endX < screenWidth * 0.25) {
                            isPaginating = true;
                            await rendition.prev();
                            setTimeout(() => { isPaginating = false; }, 150);
                        } 
                        else if (endX > screenWidth * 0.75) {
                            isPaginating = true;
                            await rendition.next();
                            setTimeout(() => { isPaginating = false; }, 150);
                        } 
                        else {
                            // Center tap - Toggle Taskbar
                            const taskbar = document.getElementById('bottom-taskbar');
                            const pinCheckbox = document.getElementById('set-pin-taskbar');
                            if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) {
                                taskbar.classList.toggle('hidden');
                            }
                        }
                    }
                } catch (err) {
                    console.warn("Recovered from epub.js rendering crash:", err);
                    isPaginating = false; // Emergency unlock
                }
            }, { passive: true });
        });
        
        window.rendition.on('relocated', function(location) {
            let currentHref = location.start.href;
            let navItem = highlightCurrentChapter(currentHref);
            
            let chapterLabel = navItem ? navItem.label.trim() : bookData.title;
            document.getElementById('chapter-title').innerText = chapterLabel;
            localStorage.setItem('bookmark-' + bookId, location.start.cfi);

            updateAndSaveProgress(location, chapterLabel);
        });

        window.rendition.hooks.content.register(function(contents) {
            let style = contents.document.createElement('style');
            style.id = 'instant-custom-theme';
            style.innerHTML = window.latestCustomCss || '';
            contents.document.head.appendChild(style);

            let startX = 0; let startY = 0; let isSwiping = false; 
            const iframeDoc = contents.document;
            
            iframeDoc.addEventListener('touchstart', e => {
                startX = e.changedTouches[0].clientX; startY = e.changedTouches[0].clientY; isSwiping = false; 
            }, { passive: true });

            iframeDoc.addEventListener('touchmove', e => {
                let diffX = Math.abs(startX - e.changedTouches[0].clientX);
                let diffY = Math.abs(startY - e.changedTouches[0].clientY);
                if (diffX > 10 || diffY > 10) isSwiping = true;
                if (savedMode === 'paginated' && diffX > diffY && diffX > 10) {
                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: savedMode === 'paginated' ? false : true });

            iframeDoc.addEventListener('touchcancel', e => { isSwiping = false; }, { passive: true });

            iframeDoc.addEventListener('touchend', e => {
                if (!isSwiping) return;
                let diffX = startX - e.changedTouches[0].clientX; 
                let diffY = Math.abs(startY - e.changedTouches[0].clientY);
                if (savedMode === 'paginated' && Math.abs(diffX) > 40 && Math.abs(diffX) > diffY * 1.5) {
                    if (diffX > 0) window.rendition.next(); else window.rendition.prev();
                }
                isSwiping = false; 
            }, { passive: true });

            iframeDoc.addEventListener('click', e => {
                if (isSwiping) return; 
                if (e.target && e.target.closest('a')) return;
                const selection = contents.window.getSelection();
                if (selection && selection.toString().length > 0) return;

                const taskbar = document.getElementById('bottom-taskbar');
                const pinCheckbox = document.getElementById('set-pin-taskbar');
                if (taskbar && pinCheckbox && !pinCheckbox.checked) taskbar.classList.toggle('hidden');
            });

            let lastScrollTop = 0;
            contents.window.addEventListener('scroll', function() {
                const taskbar = document.getElementById('bottom-taskbar');
                const pinCheckbox = document.getElementById('set-pin-taskbar');
                if (pinCheckbox && pinCheckbox.checked) { if(taskbar) taskbar.classList.remove('hidden'); return; }
                
                let st = contents.window.scrollY || contents.document.documentElement.scrollTop;
                if (Math.abs(lastScrollTop - st) <= 5) return;

                if (taskbar) {
                    if (st > lastScrollTop && st > 20) taskbar.classList.add('hidden');
                    else if (st < lastScrollTop) taskbar.classList.remove('hidden');
                }
                lastScrollTop = st <= 0 ? 0 : st;
            }, { passive: true });
        });

        window.book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            
            const flattenToc = (items, level = 0) => {
                items.forEach(function(chapter) {
                    let li = document.createElement('li');
                    li.className = 'list-item';
                    li.dataset.href = chapter.href; 
                    let padding = level * 15; 
                    
                    li.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding-left: ${padding}px;">
                            <span style="color: var(--text-color);">${chapter.label}</span>
                            <span class="toc-page-num" data-href="${chapter.href}" style="font-size:12px; color:var(--text-muted); background:var(--border); padding:2px 6px; border-radius:4px;">...</span>
                        </div>`;
                        
                    li.onclick = () => { window.rendition.display(chapter.href); window.closeAllModals(); };
                    tocList.appendChild(li);
                    
                    if (chapter.subitems && chapter.subitems.length > 0) flattenToc(chapter.subitems, level + 1);
                });
            };
            
            flattenToc(toc);

            const updateTocSpans = () => {
                const pageSpans = document.querySelectorAll('.toc-page-num');
                const hasLocs = window.book.locations && (window.book.locations.total > 0 || (typeof window.book.locations.length === 'function' && window.book.locations.length() > 0));
                
                pageSpans.forEach(span => {
                    let href = span.dataset.href;
                    let spineItem = window.book.spine.get(href);
                    if (spineItem && spineItem.cfiBase && hasLocs) {
                        try {
                            let percentage = window.book.locations.percentageFromCfi(spineItem.cfiBase);
                            let total = window.book.locations.total || 0;
                            if (total > 0) span.innerText = `Pg. ${Math.max(1, Math.round(percentage * total))}`;
                            else span.innerText = `${Math.round(percentage * 100)}%`;
                        } catch(e) { span.innerText = ''; }
                    } else span.innerText = '';
                });
            };

            if (!cachedLocations) {
                window.book.locations.generate(1024).then(() => {
                    localStorage.setItem('locations-' + bookId, window.book.locations.save());
                    updateTocSpans();
                    
                    const currentLocation = window.rendition.currentLocation();
                    if (currentLocation && currentLocation.start) {
                        let chapterLabel = document.getElementById('chapter-title').innerText;
                        updateAndSaveProgress(currentLocation, chapterLabel);
                        highlightCurrentChapter(currentLocation.start.href); 
                    }
                }).catch(() => { updateTocSpans(); });
            } else {
                updateTocSpans();
                const curLoc = window.rendition.currentLocation();
                if (curLoc && curLoc.start) highlightCurrentChapter(curLoc.start.href);
            }
        });
    });
};

window.closeReader = function(pushHistory = true) {
    document.getElementById('reader-container').style.display = 'none';
    if(window.book) window.book.destroy();
    window.book = null; window.rendition = null;
    
    if (pushHistory) window.showView('library');
    if (typeof window.loadLibrary === 'function') window.loadLibrary();
};

window.toggleSettings = function() { 
    window.closeAllModals();
    document.getElementById('settings-modal').classList.add('active'); 
};

window.setTextAlign = function(align) {
    localStorage.setItem('text-align', align);
    window.updateSettings();
};

window.setReaderTheme = function(theme) {
    localStorage.setItem('reader-theme', theme);
    const colorPicker = document.getElementById('set-text-color');
    if (colorPicker) {
        if (theme === 'dark') colorPicker.value = '#e4e4e7';
        else if (theme === 'light') colorPicker.value = '#18181b';
        else if (theme === 'paper') colorPicker.value = '#1a1815';
        else if (theme === 'blue') colorPicker.value = '#18181b';
    }
    window.updateSettings();
};

window.updateSettings = function() {
    const isPinned = document.getElementById('set-pin-taskbar').checked;
    localStorage.setItem('pin-taskbar', isPinned);
    if (isPinned) document.getElementById('bottom-taskbar').classList.remove('hidden');

    const readerTheme = localStorage.getItem('reader-theme') || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    
    const themeSelect = document.getElementById('set-reader-theme');
    if (themeSelect) themeSelect.value = readerTheme;

    let targetBgColor = '#ffffff'; 
    if (readerTheme === 'dark') targetBgColor = '#000000';
    else if (readerTheme === 'paper') targetBgColor = '#e2d6c1';
    else if (readerTheme === 'blue') targetBgColor = '#ABC9E0';

    const readerContainer = document.getElementById('reader-container');
    const viewer = document.getElementById('viewer');
    if (readerContainer && viewer) {
        readerContainer.style.background = targetBgColor; 
        viewer.style.background = targetBgColor;
    }

    const fontSize = document.getElementById('set-font').value + 'px';
    const lineHeight = document.getElementById('set-line').value;
    const fontFamily = document.getElementById('set-font-family').value;
    const textColor = document.getElementById('set-text-color').value;
    
    const textAlign = localStorage.getItem('text-align') || 'left';
    const leftBtn = document.getElementById('align-left');
    const centerBtn = document.getElementById('align-center');
    if(leftBtn && centerBtn) {
        if(textAlign === 'left') { leftBtn.classList.add('active'); centerBtn.classList.remove('active'); }
        else { centerBtn.classList.add('active'); leftBtn.classList.remove('active'); }
    }

    const paraSpacingEl = document.getElementById('set-para-spacing');
    const paraSpacing = paraSpacingEl ? paraSpacingEl.value + 'em' : '0em';

    const indentEl = document.getElementById('set-indent');
    const textIndent = indentEl ? indentEl.value + 'em' : '0em';
    
    const savedMode = localStorage.getItem('reader-mode') || 'paginated';

    // KOPUB LIGHT FONT-WEIGHT INJECTION 
    // Automatically applies a lighter 300 weight for optimal reading if KoPub is chosen.
    const fontWeight = fontFamily.includes('KoPub') ? '300' : 'normal';

    window.latestCustomCss = `
        * { background: transparent !important; background-color: transparent !important; }
        html, body { background: ${targetBgColor} !important; background-color: ${targetBgColor} !important; }
        html, body, p, div, span, h1, h2, h3, h4, h5, h6, li, a { color: ${textColor} !important; }
        p { margin-bottom: ${paraSpacing} !important; text-align: ${textAlign} !important; text-indent: ${textIndent} !important; line-height: ${lineHeight} !important; }
        body { text-align: ${textAlign} !important; font-family: ${fontFamily} !important; font-weight: ${fontWeight} !important; }
        img { max-width: 100% !important; display: block !important; margin: 0 auto !important; object-fit: contain !important; position: static !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.4); border-radius: 10px; }
        ${savedMode === 'continuous' || savedMode === 'scrolled' ? 
            `html { overflow-x: hidden !important; }
             body { max-width: 900px !important; margin: 0 auto !important; padding: 0 20px 80px 20px !important; overflow-x: hidden !important; }
             img { height: auto !important; }` 
        : 
            `html { touch-action: pan-y !important; }
             body { padding: 0 !important; margin: 0 !important; touch-action: pan-y !important; }
             img { max-height: 95vh !important; height: auto !important; }`
        }
    `;

    if (window.rendition) {
        window.rendition.themes.fontSize(fontSize); 
        if (window.rendition.getContents) {
            window.rendition.getContents().forEach(content => {
                let style = content.document.getElementById('instant-custom-theme');
                if (!style) {
                    style = content.document.createElement('style');
                    style.id = 'instant-custom-theme';
                    content.document.head.appendChild(style);
                }
                style.innerHTML = window.latestCustomCss;
            });
        }
    }

    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;
    if (document.getElementById('val-para-spacing')) document.getElementById('val-para-spacing').innerText = paraSpacing;
    if (document.getElementById('val-indent')) document.getElementById('val-indent').innerText = textIndent;
};

window.changeReadMode = function() {
    const mode = document.getElementById('set-read-mode').value;
    localStorage.setItem('reader-mode', mode);

    if (window.rendition && window.currentBookId) {
        const location = window.rendition.currentLocation();
        if (location && location.start) localStorage.setItem('bookmark-' + window.currentBookId, location.start.cfi);
    }

    window.closeAllModals();
    document.getElementById('chapter-title').innerText = "Changing mode...";
    setTimeout(() => { window.openReader(window.currentBookId, false); }, 100);
};

window.toggleTOC = function() {
    window.closeAllModals();
    document.getElementById('toc-modal').classList.add('active');
    
    setTimeout(() => {
        const activeItem = document.querySelector('#toc-list .active-toc');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    }, 10);
};

window.saveBookmark = function() {
    if(!window.rendition || !window.currentBookId) return;
    const location = window.rendition.currentLocation();
    if(!location) return;
    
    localStorage.setItem('bookmark-' + window.currentBookId, location.start.cfi);
    let chapterLabel = document.getElementById('chapter-title').innerText;
    let percent = 0;
    
    const oldStr = localStorage.getItem('progress-' + window.currentBookId);
    if(oldStr) { try { percent = JSON.parse(oldStr).percentage || 0; } catch(e){} }

    const isGenerated = window.book.locations && ((typeof window.book.locations.length === 'function' && window.book.locations.length() > 0) || window.book.locations.length > 0 || window.book.locations.total > 0);

    if (isGenerated) {
        try {
            let pFloat = window.book.locations.percentageFromCfi(location.start.cfi);
            if (pFloat !== null && pFloat >= 0 && pFloat <= 1) percent = Math.round(pFloat * 100);
        } catch(e) {}
    }
    
    localStorage.setItem('progress-' + window.currentBookId, JSON.stringify({ chapter: chapterLabel, percentage: percent }));
    alert('Progress manually bookmarked!');
};
