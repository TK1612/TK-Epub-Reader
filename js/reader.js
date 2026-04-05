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

    let renderOptions = { 
        width: "100%", 
        height: "100%", 
        spread: "none",
        manager: "default",
        flow: savedMode === 'continuous' || savedMode === 'scrolled' ? "scrolled-doc" : "paginated"
    };
    
    window.rendition = window.book.renderTo("viewer", renderOptions);
    
    // Auto-resize on phone rotation
    window.addEventListener("resize", () => {
        if (window.rendition) window.rendition.resize();
    });
    
    // -------------------------------------------------------------
    // CSS THEME INJECTION
    // -------------------------------------------------------------
    let themeCSS = {
        "img": { 
            "max-width": "100% !important", 
            "max-height": "90vh !important", 
            "object-fit": "contain !important",
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
            "padding": "0 20px 80px 20px !important",
            "overflow-x": "hidden" 
        };
    } else {
        // FIXED: Zero padding or margins for Paginated Mode to stop the 1-Page bug natively
        themeCSS["body"] = { 
            "padding": "0 !important",
            "margin": "0 !important",
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
        // FIXED: THE "READEST" SEPARATED SWIPE & CLICK LOGIC
        // -------------------------------------------------------------
        window.rendition.hooks.content.register(function(contents) {
            let startX = 0;
            let startY = 0;
            let isSwiping = false; // The magic flag to separate swipes from clicks
            const iframeDoc = contents.document;
            
            iframeDoc.addEventListener('touchstart', e => {
                startX = e.changedTouches[0].screenX;
                startY = e.changedTouches[0].screenY;
                isSwiping = false; // Reset the flag on touch
            }, { passive: true });

            iframeDoc.addEventListener('touchmove', e => {
                let currentX = e.changedTouches[0].screenX;
                let currentY = e.changedTouches[0].screenY;
                let diffX = Math.abs(startX - currentX);
                let diffY = Math.abs(startY - currentY);

                // If finger moves more than 10 pixels, it is officially a Swipe, not a Click
                if (diffX > 10 || diffY > 10) {
                    isSwiping = true;
                }
            }, { passive: true });

            iframeDoc.addEventListener('touchend', e => {
                // If it's a tap, let the 'click' event handle the UI toggle natively
                if (!isSwiping) return;

                // Handle the Page Swipe
                let endX = e.changedTouches[0].screenX;
                let endY = e.changedTouches[0].screenY;
                let diffX = startX - endX; 
                let diffY = Math.abs(startY - endY);

                if (Math.abs(diffX) > 40 && Math.abs(diffX) > diffY) {
                    if (diffX > 0) window.rendition.next();
                    else window.rendition.prev();
                }
            }, { passive: true });

            // This naturally catches Taps on Mobile AND Mouse Clicks on PC
            iframeDoc.addEventListener('click', e => {
                if (isSwiping) return; // Prevent double-firing if a swipe finished
                
                // Ignore if clicking a link or highlighting text
                if (e.target && e.target.closest('a')) return;
                const selection = contents.window.getSelection();
                if (selection && selection.toString().length > 0) return;

                // Toggle Taskbar safely
                const taskbar = document.getElementById('bottom-taskbar');
                const pinCheckbox = document.getElementById('set-pin-taskbar');
                if (taskbar && pinCheckbox && !pinCheckbox.checked) {
                    taskbar.classList.toggle('hidden');
                }
            });

            // Auto-hide scroll logic (Continuous mode)
            let lastScrollTop = 0;
            contents.window.addEventListener('scroll', function() {
                const taskbar = document.getElementById('bottom-taskbar');
                const pinCheckbox = document.getElementById('set-pin-taskbar');
                
                if (pinCheckbox && pinCheckbox.checked) {
                    if(taskbar) taskbar.classList.remove('hidden');
                    return;
                }
                let st = contents.window.scrollY || contents.document.documentElement.scrollTop;
                if (Math.abs(lastScrollTop - st) <= 5) return;

                if (taskbar) {
                    if (st > lastScrollTop && st > 20) taskbar.classList.add('hidden');
                    else if (st < lastScrollTop) taskbar.classList.remove('hidden');
                }
                lastScrollTop = st <= 0 ? 0 : st;
            }, { passive: true });
        });

        // -------------------------------------------------------------
        // TOC FLATTENING
        // -------------------------------------------------------------
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
