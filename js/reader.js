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

    let renderOptions = { width: "100%", height: "100%", spread: "none" };
    
    if (savedMode === 'continuous') {
        renderOptions.manager = "continuous"; renderOptions.flow = "scrolled-doc";
    } else if (savedMode === 'scrolled') {
        renderOptions.manager = "default"; renderOptions.flow = "scrolled-doc";
    } else {
        renderOptions.manager = "default"; renderOptions.flow = "paginated";
    }
    
    window.rendition = window.book.renderTo("viewer", renderOptions);
    
    const chapterGap = savedMode === 'continuous' ? "35vh !important" : "0px !important";

    window.rendition.themes.default({
        "img, image, svg": {
            "max-width": "100% !important",
            "max-height": "100vh !important",
            "height": "auto !important",
            "width": "auto !important",
            "display": "block !important",
            "margin": "0 auto !important",
            "position": "static !important",
            "object-fit": "contain !important" 
        },
        "div, figure": {
            "position": "static !important",
            "max-width": "100% !important",
            "height": "auto !important"
        },
        "html": {
            "height": "auto !important",
            "min-height": "auto !important",
            "overflow-y": "auto !important"
        },
        "body::after": {
            "content": "'' !important",
            "display": "block !important",
            "height": chapterGap 
        },
        "body": {
            "max-width": "900px !important", 
            "margin": "0 auto !important", 
            "padding-left": "24px !important",
            "padding-right": "24px !important",
            "padding-bottom": "120px !important", 
            "padding-top": "40px !important",
            "height": "auto !important",
            "min-height": "auto !important",
            "overflow-y": "auto !important",
            "box-sizing": "border-box !important"
        },
        "::-webkit-scrollbar": { "width": "8px", "height": "8px" },
        "::-webkit-scrollbar-track": { "background": "transparent" },
        "::-webkit-scrollbar-thumb": { "background": "rgba(150, 150, 150, 0.3)", "border-radius": "10px" }
    });

    window.rendition.themes.register("dark", { "html": { "background": "transparent"}, "body": { "background": "transparent", "color": "#f4f4f5" }});
    window.rendition.themes.register("light", { "html": { "background": "transparent"}, "body": { "background": "transparent", "color": "#1f2937" }});
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    window.rendition.themes.select(isDark ? "dark" : "light");

    window.updateSettings();

    window.book.ready.then(() => {
        const savedCfi = localStorage.getItem('bookmark-' + bookId);
        if (savedCfi) window.rendition.display(savedCfi);
        else window.rendition.display();

        window.rendition.on('relocated', function(location) {
            let chapterTitle = "Unknown Chapter";
            const spineItem = window.book.spine.get(location.start.cfi);
            let navItem = window.book.navigation.get(location.start.href);

            if (!navItem && spineItem) {
                navItem = window.book.navigation.toc.find(item => item.href.split('#')[0] === spineItem.href.split('#')[0]);
            }

            if (navItem && navItem.label) {
                chapterTitle = navItem.label.trim();
            } else if (spineItem) {
                chapterTitle = `Chapter ${spineItem.index + 1}`;
            } else {
                chapterTitle = bookData.title;
            }

            document.getElementById('chapter-title').innerText = chapterTitle;
            localStorage.setItem('bookmark-' + bookId, location.start.cfi);

            document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active-toc'));
            if (navItem && navItem.href) {
                const activeEl = Array.from(document.querySelectorAll('.toc-item')).find(el => el.dataset.href === navItem.href);
                if (activeEl) activeEl.classList.add('active-toc');
            } else if (spineItem) {
                 const activeEl = Array.from(document.querySelectorAll('.toc-item')).find(el => el.dataset.href.includes(spineItem.href));
                 if (activeEl) activeEl.classList.add('active-toc');
            }
            
            // Tiered Progress Calculation (prevents jump to 0%)
            let percentage = 0;
            if (window.book.locations && window.book.locations.length() > 0) {
                percentage = Math.floor(window.book.locations.percentageFromCfi(location.start.cfi) * 100);
            } else if (spineItem && window.book.spine && window.book.spine.spineItems) {
                percentage = Math.floor((spineItem.index / window.book.spine.spineItems.length) * 100);
            }
            percentage = Math.max(0, Math.min(100, percentage));
            
            localStorage.setItem('progress-' + bookId, JSON.stringify({
                chapter: chapterTitle,
                percentage: percentage
            }));
        });

        window.rendition.hooks.content.register(function(contents) {
            let touchStartX = 0; let touchEndX = 0;
            const taskbar = document.getElementById('bottom-taskbar');

            // --- MODIFIED: Proper Hide/Show logic inside iframe ---
            let lastScrollTop = 0;
            contents.window.addEventListener('scroll', function() {
                // If pinned, NEVER hide
                const isPinned = localStorage.getItem('pin-taskbar') === 'true';
                if (isPinned) {
                    taskbar.classList.remove('hidden');
                    return;
                }

                let st = contents.window.pageYOffset || contents.document.documentElement.scrollTop;
                if (st > lastScrollTop && st > 20) {
                    // Scrolling down - hide
                    taskbar.classList.add('hidden'); 
                } else if (st < lastScrollTop) {
                    // Scrolling up - show
                    taskbar.classList.remove('hidden'); 
                }
                lastScrollTop = st <= 0 ? 0 : st;
            }, { passive: true });

            // Restore taskbar on tap anywhere in content frame
            contents.document.addEventListener('click', function() {
                taskbar.classList.remove('hidden');
            });

            contents.document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
            contents.document.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                const threshold = 60; 
                if (touchEndX < touchStartX - threshold) window.rendition.next();
                if (touchEndX > touchStartX + threshold) window.rendition.prev();
            }, { passive: true });
        });

        window.book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            
            toc.forEach(function(chapter, index) {
                let li = document.createElement('li');
                li.className = 'list-item toc-item';
                li.dataset.href = chapter.href; 
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width: 100%;">
                        <span class="toc-label" style="flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;">${chapter.label}</span>
                        <span id="toc-page-${index}" style="font-size:12px; color:var(--text-muted); background:var(--border); padding:4px 8px; border-radius:6px; flex-shrink: 0;">...</span>
                    </div>`;
                
                li.onclick = (e) => { 
                    e.preventDefault(); 
                    window.rendition.display(chapter.href); 
                    window.closeAllModals(); 
                };
                tocList.appendChild(li);
            });

            window.book.locations.generate(1024).then(() => {
                toc.forEach(function(chapter, index) {
                    let spineItem = window.book.spine.get(chapter.href);
                    let pageNum = "";
                    if(spineItem && spineItem.cfiBase) {
                        let percentage = window.book.locations.percentageFromCfi(spineItem.cfiBase);
                        pageNum = Math.max(1, Math.round(percentage * window.book.locations.total));
                    }
                    const pageSpan = document.getElementById('toc-page-' + index);
                    if(pageSpan) pageSpan.innerText = pageNum ? `Pg. ${pageNum}` : '';
                });
                
                const currentLocation = window.rendition.currentLocation();
                if (currentLocation) window.rendition.emit('relocated', currentLocation);
                
            }).catch(() => {
                toc.forEach((c, i) => {
                    let el = document.getElementById('toc-page-' + i);
                    if (el) el.innerText = '';
                });
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
    // --- MODIFIED: Ensure proper localStorage update based on checkbox ---
    const isPinnedChecked = document.getElementById('set-pin-taskbar').checked;
    localStorage.setItem('pin-taskbar', isPinnedChecked);
    
    const taskbar = document.getElementById('bottom-taskbar');
    if (isPinnedChecked) {
        taskbar.classList.remove('hidden'); // Force visible if pinned
    }

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
    
    setTimeout(() => {
        window.openReader(window.currentBookId, false);
    }, 100);
};

window.toggleTOC = function() {
    window.closeAllModals();
    document.getElementById('toc-modal').classList.add('active');
    
    setTimeout(() => {
        const activeEl = document.querySelector('.active-toc');
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
};

window.saveBookmark = function() {
    if(!window.rendition || !window.currentBookId) return;
    const location = window.rendition.currentLocation();
    if(!location) return;
    localStorage.setItem('bookmark-' + window.currentBookId, location.start.cfi);
    alert('Progress manually bookmarked!');
};
