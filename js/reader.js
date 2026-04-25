window.book = null;
window.rendition = null;
window.activeBookId = null;

window.openReader = async function(bookId) {
    window.activeBookId = bookId;
    document.getElementById('app').style.display = 'none';
    document.getElementById('reader-container').style.display = 'block';
    document.getElementById('chapter-title').innerText = "Loading...";

    const bookData = await localforage.getItem(bookId);
    if (!bookData || !bookData.buffer) {
        alert("Error loading book data.");
        window.closeReader();
        return;
    }

    window.book = ePub(bookData.buffer);
    
    const viewer = document.getElementById('viewer');
    viewer.innerHTML = '';

    const readMode = document.getElementById('set-read-mode').value || 'paginated';
    
    window.rendition = window.book.renderTo(viewer, {
        manager: readMode === 'continuous' ? "continuous" : "default",
        flow: readMode === 'paginated' ? "paginated" : "scrolled",
        width: "100%",
        height: "100%",
        snap: true
    });

    // Apply settings before displaying
    window.updateSettings(false); 

    // Load saved location
    const savedLocation = localStorage.getItem('bookmark-' + bookId);
    if (savedLocation) {
        window.rendition.display(savedLocation);
    } else {
        window.rendition.display();
    }

    window.rendition.on("relocated", function(location) {
        // Auto-save progress
        localStorage.setItem('bookmark-' + bookId, location.start.cfi);
        
        const toc = window.book.navigation.get(location.start.href);
        let chapterName = toc ? toc.label : "Chapter";
        document.getElementById('chapter-title').innerText = chapterName;
        
        // Save detailed progress for library view
        localStorage.setItem('progress-' + bookId, JSON.stringify({
            chapter: chapterName,
            percentage: window.book.locations.length ? window.book.locations.percentageFromCfi(location.start.cfi) : 0
        }));
    });

    window.book.ready.then(() => {
        return window.book.locations.generate(1600);
    }).catch(err => console.warn("Locations generation skipped:", err));

    window.book.loaded.navigation.then(function(toc) {
        const tocList = document.getElementById('toc-list');
        tocList.innerHTML = '';
        toc.forEach(function(chapter) {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerText = chapter.label;
            li.onclick = () => {
                window.rendition.display(chapter.href);
                if (window.closeAllModals) window.closeAllModals();
                else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            };
            tocList.appendChild(li);
        });
    });

    // --- OLD TOUCHEND SWIPE LOGIC (RESTORED) ---
    window.rendition.hooks.content.register(function(contents) {
        let startX = 0;
        let startY = 0;
        let startTime = 0;

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
            
            // 1. SWIPE LOGIC (Horizontal flick)
            if (timeTaken < 300 && Math.abs(deltaX) > 40 && Math.abs(deltaY) < 40) {
                if (deltaX > 0) {
                    window.rendition.prev();
                } else {
                    window.rendition.next();
                }
            } 
            // 2. TAP LOGIC (Almost zero movement)
            else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                // Ignore if clicking a hyperlink inside the book
                if (event.target && event.target.tagName && event.target.tagName.toLowerCase() !== 'a') {
                    const taskbar = document.getElementById('bottom-taskbar');
                    const pinCheckbox = document.getElementById('set-pin-taskbar');
                    if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) {
                        taskbar.classList.toggle('hidden');
                    }
                }
            }
        }, { passive: true });
    });
};

window.closeReader = function() {
    if (window.book) {
        window.book.destroy();
        window.book = null;
        window.rendition = null;
    }
    document.getElementById('reader-container').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    
    // Refresh library when returning to home screen
    if (typeof window.loadLibrary === 'function') {
        window.loadLibrary(typeof currentLibraryPage !== 'undefined' ? currentLibraryPage : 1); 
    }
};

window.updateSettings = function(refreshRendition = true) {
    if (!window.rendition) return;

    const theme = document.getElementById('set-reader-theme').value;
    const fontSize = document.getElementById('set-font').value + 'px';
    const lineHeight = document.getElementById('set-line').value;
    const paraSpacing = document.getElementById('set-para-spacing').value + 'em';
    const indent = document.getElementById('set-indent').value + 'em';
    const fontFamily = document.getElementById('set-font-family').value;
    const textColor = document.getElementById('set-text-color').value;
    const alignBtn = document.querySelector('.segment-btn.active');
    const textAlign = alignBtn ? (alignBtn.id === 'align-center' ? 'center' : 'left') : 'left';

    // Update UI Labels
    const valFont = document.getElementById('val-font'); if (valFont) valFont.innerText = fontSize;
    const valLine = document.getElementById('val-line'); if (valLine) valLine.innerText = lineHeight;
    const valPara = document.getElementById('val-para-spacing'); if (valPara) valPara.innerText = paraSpacing;
    const valIndent = document.getElementById('val-indent'); if (valIndent) valIndent.innerText = indent;

    // Apply Themes
    let bgColor = '#18181b';
    let color = textColor;
    
    if (theme === 'light') { bgColor = '#ffffff'; color = textColor === '#e4e4e7' ? '#000000' : textColor; }
    else if (theme === 'paper') { bgColor = '#f4ecd8'; color = textColor === '#e4e4e7' ? '#333333' : textColor; }
    else if (theme === 'blue') { bgColor = '#e8f4f8'; color = textColor === '#e4e4e7' ? '#1a365d' : textColor; }

    document.getElementById('reader-container').style.backgroundColor = bgColor;

    window.rendition.themes.register("custom", {
        "body": {
            "background": bgColor + " !important",
            "color": color + " !important",
            "font-family": fontFamily + " !important",
            "font-size": fontSize + " !important",
            "line-height": lineHeight + " !important",
            "text-align": textAlign + " !important"
        },
        "p": {
            "margin-bottom": paraSpacing + " !important",
            "text-indent": indent + " !important"
        }
    });
    window.rendition.themes.select("custom");
};

window.setReaderTheme = function(themeValue) {
    window.updateSettings();
};

window.setTextAlign = function(align) {
    document.getElementById('align-left').classList.remove('active');
    document.getElementById('align-center').classList.remove('active');
    document.getElementById('align-' + align).classList.add('active');
    window.updateSettings();
};

window.changeReadMode = function() {
    if (!window.activeBookId || !window.rendition) return;
    try {
        const currentLocation = window.rendition.currentLocation();
        if (currentLocation && currentLocation.start) {
            localStorage.setItem('bookmark-' + window.activeBookId, currentLocation.start.cfi);
        }
    } catch(e) {}
    
    window.book.destroy();
    window.openReader(window.activeBookId);
};

window.toggleTOC = function() {
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('toc-modal').classList.add('active');
};

window.toggleSettings = function() {
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('settings-modal').classList.add('active');
};

window.toggleSearch = function() {
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('search-modal').classList.add('active');
    document.getElementById('global-search-input').focus();
};

window.saveBookmark = function() {
    if (!window.rendition || !window.activeBookId) return;
    try {
        const location = window.rendition.currentLocation();
        if (location && location.start) {
            localStorage.setItem('bookmark-' + window.activeBookId, location.start.cfi);
            alert("Progress manually bookmarked!");
        } else {
            alert("Please wait for the page to finish loading before bookmarking.");
        }
    } catch (e) {
        alert("Error saving bookmark.");
    }
};

window.runGlobalSearch = async function() {
    if (!window.book) return;
    const query = document.getElementById('global-search-input').value;
    if (!query) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="padding:10px;">Searching...</div>';

    try {
        const results = await Promise.all(
            window.book.spine.spineItems.map(item => 
                item.load(window.book.load.bind(window.book)).then(doc => {
                    const text = doc.textContent || "";
                    const matches = [];
                    let regex = new RegExp(query, "gi");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const snippet = text.substring(Math.max(0, match.index - 30), match.index + query.length + 30);
                        matches.push({ cfi: item.cfiFromElement(match[0] ? match[0] : doc.body), snippet: snippet });
                    }
                    item.unload();
                    return matches;
                })
            )
        );

        const allMatches = results.flat();
        resultsContainer.innerHTML = '';

        if (allMatches.length === 0) {
            resultsContainer.innerHTML = '<div style="padding:10px;">No results found.</div>';
            return;
        }

        allMatches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<span style="font-size: 13px;">...${match.snippet.replace(new RegExp(query, 'gi'), match => `<strong style="color:var(--accent);">${match}</strong>`)}...</span>`;
            li.onclick = () => {
                window.rendition.display(match.cfi);
                if (window.closeAllModals) window.closeAllModals();
                else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            };
            resultsContainer.appendChild(li);
        });
    } catch (e) {
        resultsContainer.innerHTML = '<div style="padding:10px; color:red;">Search failed.</div>';
    }
};
