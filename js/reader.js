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

    // Use strict percentages so Epub.js reads the 100dvh CSS container perfectly
    let renderOptions = { 
        width: "100%", 
        height: "100%", 
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
    
    // Resize listener ensures columns recalculate if you rotate your phone
    window.addEventListener("resize", () => {
        if (window.rendition) window.rendition.resize();
    });
    
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
        // PAGINATED MODE: Absolutely NO overflow limitations. Let it calculate columns freely.
        themeCSS["body"] = { 
            "padding": "0 15px !important"
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
        // NATIVE EPUB.JS EVENT TUNNELING (Fixes Swipe & Click natively)
        // -------------------------------------------------------------
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        window.rendition.on('touchstart', function(event) {
            let touch = event.changedTouches ? event.changedTouches[0] : event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
        });

        window.rendition.on('touchend', function(event) {
            let touch = event.changedTouches ? event.changedTouches[0] : event.touches[0];
            let diffX = touchStartX - touch.clientX; 
            let diffY = Math.abs(touchStartY - touch.clientY);
            let timeTaken = Date.now() - touchStartTime;

            // Highly accurate Swipe Detection (>40px movement, horizontal bias, <500ms)
            if (timeTaken < 500 && Math.abs(diffX) > 40 && Math.abs(diffX) > diffY) {
                if (diffX > 0) window.rendition.next();
                else window.rendition.prev();
            }
        });

        window.rendition.on('click', function(event) {
            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');
            
            // Ignore if clicking a hyperlink
            if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'a') return;
            
            // Ignore if selecting text to copy
            const contents = window.rendition.getContents()[0];
            if (contents) {
                const selection = contents.window.getSelection();
                if (selection && selection.toString().length > 0) return;
            }

            // Hide/Show taskbar gracefully
            if (!pinCheckbox.checked) {
                taskbar.classList.toggle('hidden');
            }
        });

        // The only thing we need hooks for is scroll-hiding the menu in continuous mode
        window.rendition.hooks.content.register(function(contents) {
            let lastScrollTop = 0;
            contents.window.addEventListener('scroll', function() {
                const taskbar = document.getElementById('bottom-taskbar');
                const pinCheckbox = document.getElementById('set-pin-taskbar');
                
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
