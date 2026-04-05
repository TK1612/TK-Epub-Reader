window.openReader = async function(bookId, pushHistory = true) {
    if (pushHistory) {
        history.pushState({ view: 'reader', bookId: bookId }, '', '#reader');
    }
    
    window.currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(window.book) window.book.destroy();
    
    window.book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'flex';
    
    // --- LOAD READING MODE ---
    let savedMode = localStorage.getItem('reader-mode');
    if (!savedMode) {
        // Defaults: Continuous for PC, Paginated for Mobile
        const isPC = window.innerWidth > 768 && !(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
        savedMode = isPC ? 'continuous' : 'paginated';
    }
    document.getElementById('set-read-mode').value = savedMode;

    let renderOptions = { width: "100%", height: "100%", spread: "none" };

    if (savedMode === 'continuous') {
        renderOptions.manager = "continuous";
        renderOptions.flow = "scrolled";
    } else if (savedMode === 'scrolled') {
        renderOptions.manager = "default"; // Stops epub from trying to stitch chapters together (fixes massive image bugs)
        renderOptions.flow = "scrolled";
    } else {
        renderOptions.manager = "default";
        renderOptions.flow = "paginated";
    }
    
    window.rendition = window.book.renderTo("viewer", renderOptions);
    
    // --- UPDATED: Image sizing back to normal 100%, added body padding ---
    window.rendition.themes.default({
        "img": {
            "max-width": "100% !important",
            "height": "auto !important",
            "display": "block",
            "margin": "0 auto"
        },
        "body": {
            "padding-bottom": "40px !important" // Ensures images/text don't stick to the bottom bar
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

        // Mobile swipe gestures
        window.rendition.hooks.content.register(function(contents) {
            let touchStartX = 0; let touchEndX = 0;
            contents.document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
            contents.document.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                const threshold = 60; 
                if (touchEndX < touchStartX - threshold) window.rendition.next();
                if (touchEndX > touchStartX + threshold) window.rendition.prev();
            }, { passive: true });
        });

        // Table of contents
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
    
    if (pushHistory) {
        window.showView('library');
    }
};

window.toggleSettings = function() { 
    window.closeAllModals();
    document.getElementById('settings-modal').classList.add('active'); 
};

window.updateSettings = function() {
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

// NEW: Dynamically change reading mode without losing your page
window.changeReadMode = function() {
    const mode = document.getElementById('set-read-mode').value;
    localStorage.setItem('reader-mode', mode);

    // Save exact current location so it resumes flawlessly
    if (window.rendition && window.currentBookId) {
        const location = window.rendition.currentLocation();
        if (location && location.start) {
            localStorage.setItem('bookmark-' + window.currentBookId, location.start.cfi);
        }
    }

    window.closeAllModals();
    
    // Briefly show a loading state while epub.js rebuilds the engine
    document.getElementById('chapter-title').innerText = "Changing mode...";
    
    // Re-open the reader. It will automatically load the mode and jump to the saved bookmark!
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
