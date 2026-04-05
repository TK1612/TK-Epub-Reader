let book = null;
let rendition = null;
let currentBookId = null;

localforage.config({ name: 'WebNovelReader', storeName: 'epubs' });

// --- UI NAVIGATION ---
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    document.getElementById('page-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    
    // Auto-close sidebar so it doesn't block content
    document.getElementById('sidebar').classList.add('collapsed');
    
    if(viewId === 'library') loadLibrary();
    if(viewId === 'bookmarks') loadBookmarksList();
};

window.toggleDarkMode = function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if(rendition) rendition.themes.select(isDark ? "light" : "dark");
};

window.closeAllModals = function() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
};

// --- LIBRARY & UPLOAD LOGIC ---
window.handleUpload = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadBtn = document.querySelector('.upload-btn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="ph ph-spinner"></i> Uploading...';
    uploadBtn.disabled = true;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const tempBook = ePub(buffer);
        
        await new Promise((resolve) => {
            tempBook.ready.then(async () => {
                const meta = tempBook.packaging.metadata;
                const title = meta.title || "Unknown Title";
                const bookId = meta.identifier || (title + Date.now() + i); 
                
                // --- FIX: Convert Blob to Base64 so covers survive page refresh ---
                let coverBase64 = "";
                const coverUrl = await tempBook.coverUrl();
                if (coverUrl) {
                    try {
                        const response = await fetch(coverUrl);
                        const blob = await response.blob();
                        coverBase64 = await new Promise((res) => {
                            const reader = new FileReader();
                            reader.onloadend = () => res(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } catch(e) { console.warn("Could not extract cover for", title); }
                }

                const bookData = { id: bookId, title: title, buffer: buffer, cover: coverBase64 };
                await localforage.setItem(bookId, bookData);
                
                tempBook.destroy();
                resolve(); 
            }).catch(() => { tempBook.destroy(); resolve(); });
        });
    }

    loadLibrary();
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;
    event.target.value = ''; 
};

window.loadLibrary = async function() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    
    localforage.iterate(function(value, key) {
        // Fallback default image if cover is missing
        const coverImg = value.cover ? value.cover : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <button class="delete-btn" onclick="deleteBook(event, '${key}')" title="Delete Book"><i class="ph ph-trash"></i></button>
            <img src="${coverImg}" class="book-cover" onclick="openReader('${key}')">
            <div class="book-info" onclick="openReader('${key}')">
                <div class="book-title">${value.title}</div>
                <div class="book-progress">Saved locally</div>
            </div>
        `;
        grid.appendChild(card);
    });
};

// NEW: Delete Book Function
window.deleteBook = async function(event, bookId) {
    event.stopPropagation(); // Prevents the reader from opening when you click delete
    if(confirm("Are you sure you want to delete this novel?")) {
        await localforage.removeItem(bookId);
        localStorage.removeItem('bookmark-' + bookId);
        loadLibrary();
    }
};

// --- READER LOGIC ---
window.openReader = async function(bookId) {
    currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(book) book.destroy();
    
    book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'flex';
    
    rendition = book.renderTo("viewer", { width: "100%", height: "100%", spread: "none" });
    
    rendition.themes.register("dark", { "body": { "background": "#0f172a", "color": "#f8fafc" }});
    rendition.themes.register("light", { "body": { "background": "#ffffff", "color": "#18181b" }});
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    rendition.themes.select(isDark ? "dark" : "light");

    updateSettings();

    book.ready.then(() => {
        const savedCfi = localStorage.getItem('bookmark-' + bookId);
        if (savedCfi) rendition.display(savedCfi);
        else rendition.display();

        rendition.on('relocated', function(location) {
            const navItem = book.navigation.get(location.start.href);
            document.getElementById('chapter-title').innerText = navItem ? navItem.label : bookData.title;
            localStorage.setItem('last-location-' + bookId, location.start.cfi);
        });

        // NEW: Generate Table of Contents
        book.loaded.navigation.then(function(toc) {
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            toc.forEach(function(chapter) {
                let li = document.createElement('li');
                li.className = 'list-item';
                li.innerText = chapter.label;
                li.onclick = () => { rendition.display(chapter.href); closeAllModals(); };
                tocList.appendChild(li);
            });
        });
    });
};

window.closeReader = function() {
    document.getElementById('reader-container').style.display = 'none';
    if(book) book.destroy();
};

window.toggleSettings = function() { 
    closeAllModals();
    document.getElementById('settings-modal').classList.add('active'); 
};

window.updateSettings = function() {
    if(!rendition) return;
    const fontSize = document.getElementById('set-font').value + 'px';
    const lineHeight = document.getElementById('set-line').value;
    const fontFamily = document.getElementById('set-font-family').value;
    
    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;

    rendition.themes.fontSize(fontSize);
    rendition.themes.font(fontFamily);
    rendition.themes.register("custom", { "p": { "line-height": lineHeight + " !important" } });
    rendition.themes.select("custom");
};

// --- MODALS (TOC, Search, Edit) ---
window.toggleTOC = function() {
    closeAllModals();
    document.getElementById('toc-modal').classList.add('active');
};

window.toggleSearch = function() {
    closeAllModals();
    document.getElementById('search-modal').classList.add('active');
};

window.runGlobalSearch = async function() {
    const query = document.getElementById('global-search-input').value.trim();
    if (!query || !book) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<p style="text-align:center;">Searching...</p>';

    let allResults = [];
    const spineItems = book.spine.spineItems;

    for (let i = 0; i < spineItems.length; i++) {
        let item = spineItems[i];
        await item.load(book.load.bind(book));
        let results = item.find(query);
        item.unload();
        
        if (results && results.length > 0) {
            let navItem = book.navigation.get(item.href);
            let chapterName = navItem ? navItem.label : `Chapter ${i + 1}`;
            results.forEach(res => allResults.push({ cfi: res.cfi, excerpt: res.excerpt, chapter: chapterName }));
        }
    }

    resultsContainer.innerHTML = '';
    if (allResults.length === 0) {
        resultsContainer.innerHTML = '<p style="color:gray; padding: 10px;">No results found.</p>';
        return;
    }

    allResults.forEach(res => {
        let div = document.createElement('div');
        div.className = 'list-item';
        let highlightedText = res.excerpt.replace(new RegExp(query, 'gi'), `<mark>$&</mark>`);
        div.innerHTML = `<strong style="color:var(--accent); display:block; margin-bottom:5px; font-size:12px;">${res.chapter}</strong><p>${highlightedText}</p>`;
        div.onclick = () => { rendition.display(res.cfi); closeAllModals(); };
        resultsContainer.appendChild(div);
    });
};

window.toggleEditMode = function() {
    closeAllModals();
    if(!rendition) return;
    const contents = rendition.getContents()[0];
    if(contents) {
        document.getElementById('html-textarea').value = contents.document.body.innerHTML;
        document.getElementById('html-editor').classList.add('active');
    }
};

window.executeReplace = function() {
    const findText = document.getElementById('find-input').value;
    const replaceText = document.getElementById('replace-input').value;
    const textarea = document.getElementById('html-textarea');
    if(!findText) return;
    try {
        const regex = new RegExp(findText, 'g');
        textarea.value = textarea.value.replace(regex, replaceText);
    } catch (e) { alert("Invalid Regex"); }
};

window.applyHTML = function() {
    const contents = rendition.getContents()[0];
    if(contents) {
        contents.document.body.innerHTML = document.getElementById('html-textarea').value;
        closeAllModals();
    }
};

// INIT
loadLibrary();
