window.openReader = async function(bookId, pushHistory = true) {
    if (pushHistory) {
        history.pushState({ view: 'reader', bookId: bookId }, '', '#reader');
    }
    
    window.currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(window.book) window.book.destroy();
    
    window.book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'block';
    
    // Load Reading Mode & Pin Status
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
    
    window.rendition.themes.default({
        "img": {
            "max-width": "100% !important",
            "height": "auto !important",
            "display": "block !important",
            "margin": "0 auto !important",
            "position": "static !important"
        },
        "div": { "position": "static !important" },
        "body": { "padding-bottom": "80px !important", "overflow-y": "auto !important" },
        "::-webkit-scrollbar": { "width": "6px", "height": "6px" },
        "::-webkit-scrollbar-track": { "background": "transparent" },
        "::-webkit-scrollbar-thumb": { "background": "rgba(150, 150, 150, 0.4)", "border-radius": "10px" }
    });

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
            const navItem = window.book.navigation.get(location.start.href);
            document.getElementById('chapter-title').innerText = navItem ? navItem.label : bookData.title;
            localStorage.setItem('bookmark-' + bookId, location.start.cfi);

            document.querySelectorAll('#toc-list .list-item').forEach(li => {
                li.classList.remove('active-toc');
                if (navItem && li.dataset.href === navItem.href) {
                    li.classList.add('active-toc');
                }
            });
        });

        // Iframe Content Hooks (Handles both Swipe & Taskbar Logic internally)
        window.rendition.hooks.content.register(function(contents) {
            let lastScrollTop = 0;
            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');

            // --- MOBILE SWIPE LOGIC (Fixed for iframes) ---
            let touchStartX = 0;
            let touchStartY = 0;

            contents.document.addEventListener('touchstart', e => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });

            contents.document.addEventListener('touchend', e => {
                let touchEndX = e.changedTouches[0].screenX;
                let touchEndY = e.changedTouches[0].screenY;
                
                let deltaX = touchEndX - touchStartX;
                let deltaY = Math.abs(touchEndY - touchStartY);

                // Swipe must be horizontal-dominant to prevent scrolling from turning the page
                if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > deltaY) {
                    if (deltaX < 0) window.rendition.next(); // Swiped left
                    else window.rendition.prev(); // Swiped right
                }
            }, { passive: true });

            // --- AUTO-HIDE SCROLL LOGIC ---
            contents.window.addEventListener('scroll', function() {
                if (pinCheckbox.checked) {
                    taskbar.classList.remove('hidden');
                    return;
                }
                let st = contents.window.scrollY || contents.document.documentElement.scrollTop;
                if (Math.abs(lastScrollTop - st) <= 5) return;

                if (st > lastScrollTop && st > 20) {
                    taskbar.classList.add('hidden'); // Scrolling down
                } else if (st < lastScrollTop) {
                    taskbar.classList.remove('hidden'); // Scrolling up
                }
                lastScrollTop = st <= 0 ? 0 : st;
            }, { passive: true });

            contents.document.addEventListener('click', function(e) {
                if (e.target.tagName.toLowerCase() === 'a') return;
                const selection = contents.window.getSelection();
                if (selection && selection.toString().length > 0) return;

                if (!pinCheckbox.checked) taskbar.classList.toggle('hidden');
                else taskbar.classList.remove('hidden');
            });
        });

        // Generate TOC
        window.book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            
            toc.forEach(function(chapter, index) {
                let li = document.createElement('li');
                li.className = 'list-item';
                li.dataset.href = chapter.href; 
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color: var(--text-color);">${chapter.label}</span>
                        <span id="toc-page-${index}" style="font-size:12px; color:var(--text-muted); background:var(--border); padding:2px 6px; border-radius:4px;">...</span>
                    </div>`;
                li.onclick = () => { window.rendition.display(chapter.href); window.closeAllModals(); };
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
    
    setTimeout(() => {
        window.openReader(window.currentBookId, false);
    }, 100);
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
