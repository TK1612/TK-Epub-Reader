window.openReader = async function(bookId) {
    window.currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(window.book) window.book.destroy();
    
    window.book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'flex';
    
    window.rendition = window.book.renderTo("viewer", { width: "100%", height: "100%", spread: "none" });
    
    // Set Pure Black Dark Theme
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

        // Generate Table of Contents with Page Numbers
        window.book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            
            // 1. Draw TOC instantly to not block the UI
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

            // 2. Generate locations asynchronously in background to find page numbers
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
                // If it fails, clear the '...' dots
                toc.forEach((c, i) => document.getElementById('toc-page-' + i).innerText = '');
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
    const textColor = document.getElementById('set-text-color').value;
    
    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;

    window.rendition.themes.fontSize(fontSize);
    window.rendition.themes.font(fontFamily);
    
    // Instead of overriding the theme completely, inject the CSS rule safely
    window.rendition.themes.override('line-height', lineHeight + ' !important');
    window.rendition.themes.override('color', textColor + ' !important');
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
