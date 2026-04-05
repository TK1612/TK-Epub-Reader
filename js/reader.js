window.openReader = async function(bookId) {
    window.currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(window.book) window.book.destroy();
    
    window.book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'flex';
    
    window.rendition = window.book.renderTo("viewer", { width: "100%", height: "100%", spread: "none" });
    
    window.rendition.themes.register("dark", { "body": { "background": "#0f172a", "color": "#f8fafc" }});
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
            // Auto-save location on page turn
            localStorage.setItem('bookmark-' + bookId, location.start.cfi);
        });

        window.book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            toc.forEach(function(chapter) {
                let li = document.createElement('li');
                li.className = 'list-item';
                li.innerText = chapter.label;
                li.onclick = () => { window.rendition.display(chapter.href); window.closeAllModals(); };
                tocList.appendChild(li);
            });
        });
    });
};

window.closeReader = function() {
    document.getElementById('reader-container').style.display = 'none';
    if(window.book) window.book.destroy();
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
    
    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;

    window.rendition.themes.fontSize(fontSize);
    window.rendition.themes.font(fontFamily);
    window.rendition.themes.register("custom", { "p": { "line-height": lineHeight + " !important" } });
    window.rendition.themes.select("custom");
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
