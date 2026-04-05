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
    }
    document.getElementById('set-read-mode').value = savedMode;
    
    const pinTaskbar = localStorage.getItem('pin-taskbar') !== 'false';
    document.getElementById('set-pin-taskbar').checked = pinTaskbar;

    // -------------------------------------------------------------
    // FIXED: EXACT PIXEL DIMENSIONS FIXES THE BLACK PAGE BUG
    // -------------------------------------------------------------
    let renderOptions = { 
        width: window.innerWidth, 
        height: window.innerHeight, 
        spread: "none" 
    };
    
    if (savedMode === 'continuous') {
        renderOptions.manager = "continuous"; renderOptions.flow = "scrolled-doc";
    } else if (savedMode === 'scrolled') {
        renderOptions.manager = "default"; renderOptions.flow = "scrolled-doc";
    } else {
        renderOptions.manager = "default"; renderOptions.flow = "paginated";
    }
    
    window.rendition = window.book.renderTo("viewer", renderOptions);
    
    // Auto-resize the reader when rotating the phone to prevent text clipping
    window.addEventListener("resize", () => {
        if (window.rendition) {
            window.rendition.resize(window.innerWidth, window.innerHeight);
        }
    });
    
    // -------------------------------------------------------------
    // FIXED: IMAGE SIZING AND STRICT OVERFLOW CSS
    // -------------------------------------------------------------
    let themeCSS = {
        "img": { 
            "max-width": "100% !important", 
            "max-height": "90vh !important", /* Stops giant covers from creating blank columns */
            "object-fit": "contain !important",
            "break-inside": "avoid !important",
            "display": "block !important", 
            "margin": "0 auto !important" 
        },
        "::-webkit-scrollbar": { "width": "6px", "height": "6px" },
        "::-webkit-scrollbar-track": { "background": "transparent" },
        "::-webkit-scrollbar-thumb": { "background": "rgba(150, 150, 150, 0.4)", "border-radius": "10px" }
    };

    if (savedMode === 'continuous' || savedMode === 'scrolled') {
        themeCSS["html"] = { "overflow-x": "hidden" };
        themeCSS["body"] = { 
            "max-width": "900px !important", 
            "margin": "0 auto !important", 
            "padding": "0 20px !important",
            "padding-bottom": "80px !important", 
            "overflow-x": "hidden" 
        };
    } else {
        // STRICT rules for paginated mode
        themeCSS["html"] = { "overflow": "hidden !important" };
        themeCSS["body"] = { 
            "margin": "0 !important", 
            "padding": "0 10px !important", /* Small breathing room */
            "overflow": "hidden !important",
            "box-sizing": "border-box !important"
        };
    }

    window.rendition.themes.default(themeCSS);
    window.rendition.themes.register("dark", { "body": { "background": "#000000", "color": "#e4e4e7" }});
    window.rendition.themes.register("light", { "body": { "background": "#ffffff", "color": "#18181b" }});
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    window.rendition.themes.select(isDark ? "dark" : "light");

    window.updateSettings();

    window.book.ready.then(() => {
        const savedCfi = localStorage.getItem('bookmark-' + bookId);
        if (savedCfi) window.rendition.display(savedCfi);
        else window.rendition.display();

        window.rendition.on('relocated', function(location) {
            let currentHref = location.start.href;
            let navItem = window.book.navigation.get(currentHref);
            
            if (!navItem) {
                const findNavItem = (items) => {
                    for (let item of items) {
                        let baseHref = item.href.split('#')[0];
                        if (baseHref === currentHref || currentHref.includes(baseHref)) return item;
                        if (item.subitems && item.subitems.length > 0) {
                            let subMatch = findNavItem(item.subitems);
                            if (subMatch) return subMatch;
                        }
                    }
                    return null;
                };
                navItem = findNavItem(window.book.navigation.toc);
            }

            document.getElementById('chapter-title').innerText = navItem ? navItem.label.trim() : bookData.title;
            localStorage.setItem('bookmark-' + bookId, location.start.cfi);

            document.querySelectorAll('#toc-list .list-item').forEach(li => {
                li.classList.remove('active-toc');
                if (navItem && li.dataset.href === navItem.href) {
                    li.classList.add('active-toc');
                }
            });
        });

        // -------------------------------------------------------------
        // FIXED: HIGH-CATCH SWIPE DETECTOR (Double Bound)
        // -------------------------------------------------------------
        let touchStartX = 0;
        let touchStartTime = 0;

        const handleTouchStart = (e) => {
            let touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
            touchStartX = touch.screenX; // screenX is immune to iframe boundary bugs
            touchStartTime = Date.now();
        };

        const handleTouchEnd = (e) => {
            let touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
            let touchEndX = touch.screenX;
            let diffX = touchStartX - touchEndX; 
            let timeTaken = Date.now() - touchStartTime;

            // Highly forgiving swipe logic: Just needs to be fast (<800ms) and intentional (>40px)
            if (timeTaken < 800 && Math.abs(diffX) > 40) {
                if (diffX > 0) window.rendition.next();
                else window.rendition.prev();
            }
        };

        // Bind to outer wrapper
        window.rendition.on('touchstart', handleTouchStart);
        window.rendition.on('touchend', handleTouchEnd);

        window.rendition.hooks.content.register(function(contents) {
            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');

            // Bind to inner wrapper
            contents.window.addEventListener('touchstart', handleTouchStart, { passive: true });
            contents.window.addEventListener('touchend', handleTouchEnd, { passive: true });

            // Auto-hide scroll logic
            let lastScrollTop = 0;
            contents.window.addEventListener('scroll', function() {
                if (pinCheckbox.checked) {
                    taskbar.classList.remove('hidden');
                    return;
                }
                let st = contents.window.scrollY || contents.document.documentElement.scrollTop;
                if (Math.abs(lastScrollTop - st) <= 5) return;

                if (st > lastScrollTop && st > 20) taskbar.classList.add('hidden');
                else if (st < lastScrollTop) taskbar.classList.remove('hidden');
                
                lastScrollTop = st <= 0 ? 0 : st;
            }, { passive: true });

            // Tap screen to show menu
            contents.document.addEventListener('click', function(e) {
                if (e.target.tagName.toLowerCase() === 'a') return;
                const selection = contents.window.getSelection();
                if (selection && selection.toString().length > 0) return;

                if (!pinCheckbox.checked) taskbar.classList.toggle('hidden');
                else taskbar.classList.remove('hidden');
            });
        });

        // Recursive TOC Generation
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
                        
                    li.onclick = () => { 
                        if (chapter.href) {
                            window.rendition.display(chapter.href); 
                            window.closeAllModals(); 
                        }
                    };
                    tocList.appendChild(li);
                    
                    if (chapter.subitems && chapter.subitems.length > 0) {
                        flattenToc(chapter.subitems, level + 1);
                    }
                });
            };
            
            flattenToc(toc);

            window.book.locations.generate(1024).then(() => {
                const pageSpans = document.querySelectorAll('.toc-page-num');
                pageSpans.forEach(span => {
                    let href = span.dataset.href;
                    let spineItem = window.book.spine.get(href);
                    if (spineItem && spineItem.cfiBase) {
                        let percentage = window.book.locations.percentageFromCfi(spineItem.cfiBase);
                        let pageNum = Math.max(1, Math.round(percentage * window.book.locations.total));
                        span.innerText = `Pg. ${pageNum}`;
                    } else {
                        span.innerText = '';
                    }
                });
            }).catch(() => {
                document.querySelectorAll('.toc-page-num').forEach(span => span.innerText = '');
            });
        });
    });
};

window.closeReader = function(pushHistory = true) {
    document.getElementById('reader-container').style.display = 'none';
    if(window.book) window.book.destroy();
    window.book = null;
    window.rendition = null;
    if (pushHistory) window.showView('library');
};

window.toggleSettings = function() { 
    window.closeAllModals();
    document.getElementById('settings-modal').classList.add('active'); 
};

window.updateSettings = function() {
    const isPinned = document.getElementById('set-pin-taskbar').checked;
    localStorage.setItem('pin-taskbar', isPinned);
    if (isPinned) document.getElementById('bottom-taskbar').classList.remove('hidden');

    if(!window.rendition) return;
    const fontSize = document.getElementById('set-font').value + 'px';
    const lineHeight = document.getElementById('set-line').value;
    const fontFamily = document.getElementById('set-font-family').value;
    const textColor = document.getElementById('set-text-color').value;
    
    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;

    window.rendition.themes.fontSize(fontSize);
    window.rendition.themes.font(fontFamily);
    window.rendition.themes.override('line-height', lineHeight + ' !important');
    window.rendition.themes.override('color', textColor + ' !important');
};

window.changeReadMode = function() {
    const mode = document.getElementById('set-read-mode').value;
    localStorage.setItem('reader-mode', mode);

    if (window.rendition && window.currentBookId) {
        const location = window.rendition.currentLocation();
        if (location && location.start) {
            localStorage.setItem('bookmark-' + window.currentBookId, location.start.cfi);
        }
    }

    window.closeAllModals();
    document.getElementById('chapter-title').innerText = "Changing mode...";
    setTimeout(() => { window.openReader(window.currentBookId, false); }, 100);
};

window.toggleTOC = function() {
    window.closeAllModals();
    document.getElementById('toc-modal').classList.add('active');
};

window.saveBookmark = function() {
    if(!window.rendition || !window.currentBookId) return;
    const location = window.rendition.currentLocation();
    if(!location) return;
    localStorage.setItem('bookmark-' + window.currentBookId, location.start.cfi);
    alert('Progress manually bookmarked!');
};
