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
    
    // FIX: Changed "scrolled" to "scrolled-doc" to fix the frozen scrollbar bug natively
    if (savedMode === 'continuous') {
        renderOptions.manager = "continuous"; renderOptions.flow = "scrolled-doc";
    } else if (savedMode === 'scrolled') {
        renderOptions.manager = "default"; renderOptions.flow = "scrolled-doc";
    } else {
        renderOptions.manager = "default"; renderOptions.flow = "paginated";
    }
    
    window.rendition = window.book.renderTo("viewer", renderOptions);
    
    // FIX: Force static positioning on images to prevent them from breaking the iframe layout
    window.rendition.themes.default({
        "img": {
            "max-width": "100% !important",
            "height": "auto !important",
            "display": "block !important",
            "margin": "0 auto !important",
            "position": "static !important" /* Stops EPUB covers from using absolute positioning to trap the screen */
        },
        "div": {
            "position": "static !important" /* Prevents image wrapper divs from overflowing */
        },
        "body": {
            "padding-bottom": "80px !important",
            "overflow-y": "auto !important"
        },
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
        });

        // 1. Mobile Swipe Logic (Using rendition events is more reliable in epub.js)
        let touchStartX = 0;
        let touchEndX = 0;

        window.rendition.on('touchstart', event => {
            touchStartX = event.changedTouches[0].screenX;
        });

        window.rendition.on('touchend', event => {
            touchEndX = event.changedTouches[0].screenX;
            const threshold = 50; 
            if (touchEndX < touchStartX - threshold) window.rendition.next();
            if (touchEndX > touchStartX + threshold) window.rendition.prev();
        });

        // 2. Iframe Content Hooks for Scrolling and Tapping
        window.rendition.hooks.content.register(function(contents) {
            let lastScrollTop = 0;
            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');

            // Auto-Hide Taskbar on Scroll (For Continuous/Scrolled Mode)
            contents.window.addEventListener('scroll', function() {
                if (pinCheckbox.checked) {
                    taskbar.classList.remove('hidden');
                    return;
                }

                let st = contents.window.scrollY || contents.document.documentElement.scrollTop;
                
                // Add a small threshold (5px) to prevent jittering on mobile
                if (Math.abs(lastScrollTop - st) <= 5) return;

                if (st > lastScrollTop && st > 20) {
                    taskbar.classList.add('hidden'); // Scrolling down
                } else if (st < lastScrollTop) {
                    taskbar.classList.remove('hidden'); // Scrolling up
                }
                lastScrollTop = st <= 0 ? 0 : st;
            }, { passive: true });

            // Tap Screen to Toggle Taskbar (Essential for Paginated Mode)
            contents.document.addEventListener('click', function(e) {
                // Ignore clicks if the user is clicking a link or highlighting text
                if (e.target.tagName.toLowerCase() === 'a') return;
                const selection = contents.window.getSelection();
                if (selection && selection.toString().length > 0) return;

                if (!pinCheckbox.checked) {
                    taskbar.classList.toggle('hidden');
                } else {
                    taskbar.classList.remove('hidden');
                }
            });
        });

        // Generate TOC
        window.book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            
            toc.forEach(function(chapter, index) {
                let li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${chapter.label}</span>
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
