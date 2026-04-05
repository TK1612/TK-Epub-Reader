// --- GLOBAL VARIABLES ---
let book = null;
let rendition = null;
let currentBookId = null;

// Initialize IndexedDB
localforage.config({ name: 'WebNovelReader', storeName: 'epubs' });

// --- UI NAVIGATION ---
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    if(viewId === 'library') loadLibrary();
    if(viewId === 'bookmarks') loadBookmarksList();
};

// --- LIBRARY MANAGEMENT ---
window.handleUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const tempBook = ePub(buffer);
    
    tempBook.ready.then(async () => {
        const meta = tempBook.packaging.metadata;
        const title = meta.title || "Unknown Title";
        const bookId = meta.identifier || title + Date.now();
        
        let coverUrl = "";
        const coverPath = await tempBook.coverUrl();
        if(coverPath) coverUrl = coverPath;

        const bookData = { id: bookId, title: title, buffer: buffer, cover: coverUrl, progress: 0 };
        await localforage.setItem(bookId, bookData);
        loadLibrary();
        tempBook.destroy();
    });
};

async function loadLibrary() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    
    localforage.iterate(function(value, key) {
        const coverImg = value.cover ? value.cover : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+';
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => openReader(key);
        card.innerHTML = `
            <img src="${coverImg}" class="book-cover">
            <div class="book-info">
                <div class="book-title">${value.title}</div>
                <div class="book-progress">Saved Locally</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- READER LOGIC ---
window.openReader = async function(bookId) {
    currentBookId = bookId;
    const bookData = await localforage.getItem(bookId);
    
    if(book) book.destroy();
    
    book = ePub(bookData.buffer);
    document.getElementById('reader-container').style.display = 'flex';
    
    rendition = book.renderTo("viewer", { width: "100%", height: "100%", spread: "none" });
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
    });
};

window.closeReader = function() {
    document.getElementById('reader-container').style.display = 'none';
    if(book) book.destroy();
};

// --- SETTINGS & THEMES ---
window.toggleSettings = function() { document.getElementById('settings-modal').classList.toggle('active'); };

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

window.toggleDarkMode = function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    
    if(rendition) {
        rendition.themes.register("dark", { "body": { "background": "#18181b", "color": "#e4e4e7" }});
        rendition.themes.register("light", { "body": { "background": "#f4f4f5", "color": "#18181b" }});
        rendition.themes.select(isDark ? "light" : "dark");
    }
};

// --- BOOKMARKS ---
window.saveBookmark = function() {
    if(!rendition || !currentBookId) return;
    const location = rendition.currentLocation();
    if(!location) return;
    
    const chapter = document.getElementById('chapter-title').innerText;
    const cfi = location.start.cfi;
    
    let bookmarks = JSON.parse(localStorage.getItem('saved-bookmarks')) || [];
    bookmarks.push({ bookId: currentBookId, chapter: chapter, cfi: cfi, date: new Date().toLocaleDateString() });
    localStorage.setItem('saved-bookmarks', JSON.stringify(bookmarks));
    alert('Bookmark saved!');
};

function loadBookmarksList() {
    const list = document.getElementById('bookmarks-list');
    list.innerHTML = '';
    const bookmarks = JSON.parse(localStorage.getItem('saved-bookmarks')) || [];
    
    bookmarks.forEach(bm => {
        const li = document.createElement('li');
        li.style.marginBottom = "10px";
        li.innerHTML = `<a href="#" onclick="openBookmark('${bm.bookId}', '${bm.cfi}')" style="color:var(--accent); text-decoration:none;">${bm.chapter} (Saved on ${bm.date})</a>`;
        list.appendChild(li);
    });
}

window.openBookmark = function(bookId, cfi) {
    showView('library');
    openReader(bookId).then(() => { setTimeout(() => rendition.display(cfi), 500); });
};

// --- HTML EDITOR ---
window.toggleEditMode = function() {
    if(!rendition) return;
    const editor = document.getElementById('html-editor');
    if (editor.style.display === 'flex') {
        closeEditor();
    } else {
        const contents = rendition.getContents()[0];
        if(contents) {
            document.getElementById('html-textarea').value = contents.document.body.innerHTML;
            editor.style.display = 'flex';
        }
    }
};

window.closeEditor = function() { document.getElementById('html-editor').style.display = 'none'; };

window.applyHTML = function() {
    const contents = rendition.getContents()[0];
    if(contents) {
        contents.document.body.innerHTML = document.getElementById('html-textarea').value;
        closeEditor();
    }
};

// INIT
loadLibrary();
