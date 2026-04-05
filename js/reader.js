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
    
    window.addEventListener("resize", () => {
        if (window.rendition) window.rendition.resize();
    });
    
    // -------------------------------------------------------------
    // CSS THEME INJECTION
    // -------------------------------------------------------------
    window.currentThemeCSS = {
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
        window.currentThemeCSS["html"] = { "overflow-x": "hidden" };
        window.currentThemeCSS["body"] = { 
            "max-width": "900px !important", 
            "margin": "0 auto !important", 
            "padding": "0 20px 80px 20px !important",
            "overflow-x": "hidden" 
        };
    } else {
        window.currentThemeCSS["html"] = { "touch-action": "pan-y !important" };
        window.currentThemeCSS["body"] = { 
            "padding": "0 !important",
            "margin": "0 !important",
            "touch-action": "pan-y !important"
        };
    }

    window.rendition.themes.default(window.currentThemeCSS);
    window.rendition.themes.register("dark", { "body": { "background": "#000000", "color": "#e4e4e7" }});
    window.rendition.themes.register("light", { "body": { "background": "#ffffff", "color": "#18181b" }});
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    window.rendition.themes.select(isDark ? "dark" : "light");

    window.updateSettings();

    window.book.ready.then(() => {
        // FIXED: Try to load cached locations before displaying to speed up percentage calculation
        const savedCfi = localStorage.getItem('bookmark-' + bookId);
        const cachedLocations = localStorage.getItem('locations-' + bookId);
        
        if (cachedLocations) {
            try { window.book.locations.load(cachedLocations); } 
            catch(e) { console.warn("Could not load cached locations"); }
        }

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

            let chapterLabel = navItem ? navItem.label.trim() : bookData.title;
            document.getElementById('chapter-title').innerText = chapterLabel;
            localStorage.setItem('bookmark-' + bookId, location.start.cfi);

            // ==========================================
            // FIXED: ROCK-SOLID PROGRESS CALCULATION
            // ==========================================
            let percent = 0;
            
            // 1. Always pull the old percentage first as a safe fallback
            const oldStr = localStorage.getItem('progress-' + bookId);
            if (oldStr) { try { percent = JSON.parse(oldStr).percentage || 0; } catch(e){} }

            // 2. Try getting the native ePub.js percentage (if calculation is done)
            if (location.start.percentage > 0 && location.start.percentage <= 1) {
                percent = Math.round(location.start.percentage * 100);
            } 
            // 3. Fallback to manually querying the locations API
            else if (window.book.locations) {
                try {
                    let pFloat = window.book.locations.percentageFromCfi(location.start.cfi);
                    // Only update if it returns a valid number between 0% and 100%
                    if (pFloat !== null && pFloat >= 0 && pFloat <= 1) {
                        percent = Math.round(pFloat * 100);
                    }
                } catch(e) {}
            }
            
            localStorage.setItem('progress-' + bookId, JSON.stringify({
                chapter: chapterLabel,
                percentage: percent
            }));

            document.querySelectorAll('#toc-list .list-item').forEach(li => {
                li.classList.remove('active-toc');
                if (navItem && li.dataset.href === navItem.href) {
                    li.classList.add('active-toc');
                }
            });
        });

        // -------------------------------------------------------------
        // HOOKS: Mobile Swipe & Standard Interactions
        // -------------------------------------------------------------
        window.rendition.hooks.content.register(function(contents) {
            let startX = 0;
            let startY = 0;
            let isSwiping = false; 
            const iframeDoc = contents.document;
            
            iframeDoc.addEventListener('touchstart', e => {
                startX = e.changedTouches[0].clientX;
                startY = e.changedTouches[0].clientY;
                isSwiping = false; 
            }, { passive: true });

            iframeDoc.addEventListener('touchmove', e => {
                let currentX = e.changedTouches[0].clientX;
                let currentY = e.changedTouches[0].clientY;
                let diffX = Math.abs(startX - currentX);
                let diffY = Math.abs(startY - currentY);

                if (diffX > 10 || diffY > 10) {
                    isSwiping = true;
                }

                if (savedMode === 'paginated' && diffX > diffY && diffX > 10) {
                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: savedMode === 'paginated' ? false : true });

            iframeDoc.addEventListener('touchcancel', e => {
                isSwiping = false;
            }, { passive: true });

            iframeDoc.addEventListener('touchend', e => {
                if (!isSwiping) return;

                let endX = e.changedTouches[0].clientX;
                let endY = e.changedTouches[0].clientY;
                let diffX = startX - endX; 
                let diffY = Math.abs(startY - endY);

                if (savedMode === 'paginated' && Math.abs(diffX) > 40 && Math.abs(diffX) > diffY * 1.5) {
                    if (diffX > 0) window.rendition.next();
                    else window.rendition.prev();
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
                if (taskbar && pinCheckbox && !pinCheckbox.checked) {
                    taskbar.classList.toggle('hidden');
                }
            });

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
        // TOC FLATTENING & LOCATIONS GENERATION
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

            const updateTocSpans = () => {
                const pageSpans = document.querySelectorAll('.toc-page-num');
                pageSpans.forEach(span => {
                    let href = span.dataset.href;
                    let spineItem = window.book.spine.get(href);
                    if (spineItem && spineItem.cfiBase && window.book.locations) {
                        try {
                            let percentage = window.book.locations.percentageFromCfi(spineItem.cfiBase);
                            let total = window.book.locations.total || 0;
                            if (total > 0) {
                                let pageNum = Math.max(1, Math.round(percentage * total));
                                span.innerText = `Pg. ${pageNum}`;
                            } else {
                                span.innerText = `${Math.round(percentage * 100)}%`;
                            }
                        } catch(e) { span.innerText = ''; }
                    } else {
                        span.innerText = '';
                    }
                });
            };

            // If locations weren't cached, generate them in the background
            if (!cachedLocations) {
                window.book.locations.generate(1024).then(() => {
                    localStorage.setItem('locations-' + bookId, window.book.locations.save());
                    updateTocSpans();
                    
                    // FIXED: Force an immediate progress save the moment generation finishes
                    const currentLocation = window.rendition.currentLocation();
                    if (currentLocation && currentLocation.start) {
                        let chapterLabel = document.getElementById('chapter-title').innerText;
                        let pFloat = window.book.locations.percentageFromCfi(currentLocation.start.cfi);
                        if (pFloat !== null && pFloat >= 0 && pFloat <= 1) {
                            localStorage.setItem('progress-' + bookId, JSON.stringify({
                                chapter: chapterLabel,
                                percentage: Math.round(pFloat * 100)
                            }));
                        }
                    }
                }).catch(() => { updateTocSpans(); });
            } else {
                updateTocSpans();
            }
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
    
    const paraSpacingEl = document.getElementById('set-para-spacing');
    const paraSpacing = paraSpacingEl ? paraSpacingEl.value + 'em' : '0em';
    
    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;
    if (document.getElementById('val-para-spacing')) {
        document.getElementById('val-para-spacing').innerText = paraSpacing;
    }

    if (window.currentThemeCSS) {
        window.currentThemeCSS["p"] = { "margin-bottom": paraSpacing + " !important" };
        window.rendition.themes.default(window.currentThemeCSS);
    }

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
    
    let chapterLabel = document.getElementById('chapter-title').innerText;
    let percent = 0;
    
    const oldStr = localStorage.getItem('progress-' + window.currentBookId);
    if(oldStr) { try { percent = JSON.parse(oldStr).percentage || 0; } catch(e){} }

    if (location.start.percentage > 0 && location.start.percentage <= 1) {
        percent = Math.round(location.start.percentage * 100);
    } else if (window.book.locations) {
        try {
            let pFloat = window.book.locations.percentageFromCfi(location.start.cfi);
            if (pFloat !== null && pFloat >= 0 && pFloat <= 1) {
                percent = Math.round(pFloat * 100);
            }
        } catch(e) {}
    }
    
    localStorage.setItem('progress-' + window.currentBookId, JSON.stringify({
        chapter: chapterLabel,
        percentage: percent
    }));

    alert('Progress manually bookmarked!');
};
