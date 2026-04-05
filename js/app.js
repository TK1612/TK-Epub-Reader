// --- GLOBAL VARIABLES ---
let book = null;
let rendition = null;
let currentBookId = null;

// Initialize IndexedDB
localforage.config({ name: 'WebNovelReader', storeName: 'epubs' });

// --- UI NAVIGATION & SIDEBAR ---
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    
    // Update header title
    document.getElementById('page-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    
    if(window.innerWidth < 768) toggleSidebar(); // Auto-close on mobile
    if(viewId === 'library') loadLibrary();
    if(viewId === 'bookmarks') loadBookmarksList();
};

window.toggleDarkMode = function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    
    if(rendition) {
        rendition.themes.select(isDark ? "light" : "dark");
    }
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

        const bookData = { id: bookId, title: title, buffer: buffer, cover: coverUrl };
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
                <div class="book-progress">Ready to read</div>
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
    
    // Register Themes early
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
    
    document.getElementById('val-font').innerText = fontSize;
    document.getElementById('val-line').innerText = lineHeight;

    rendition.themes.fontSize(fontSize);
    rendition.themes.register("custom", { "p": { "line-height": lineHeight + " !important" } });
    rendition.themes.select("custom");
};

// --- GLOBAL SEARCH ---
window.toggleSearch = function() {
    closeAllModals();
    document.getElementById('search-modal').classList.add('active');
};

window.runGlobalSearch = async function() {
    const query = document.getElementById('global-search-input').value.trim();
    if (!query || !book) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<p style="text-align:center;">Searching through chapters...</p>';

    let allResults = [];
    const spineItems = book.spine.spineItems;

    // Search through every single chapter in the background
    for (let i = 0; i < spineItems.length; i++) {
        let item = spineItems[i];
        await item.load(book.load.bind(book));
        let results = item.find(query);
        item.unload();
        
        if (results && results.length > 0) {
            let navItem = book.navigation.get(item.href);
            let chapterName = navItem ? navItem.label : `Chapter ${i + 1}`;
            
            results.forEach(res => {
                allResults.push({ cfi: res.cfi, excerpt: res.excerpt, chapter: chapterName });
            });
        }
    }

    resultsContainer.innerHTML = '';
    if (allResults.length === 0) {
        resultsContainer.innerHTML = '<p style="color:gray;">No results found.</p>';
        return;
    }

    // Render results
    allResults.forEach(res => {
        let div = document.createElement('div');
        div.className = 'search-result-item';
        // Highlight the searched word
        let highlightedText = res.excerpt.replace(new RegExp(query, 'gi'), `<mark>$&</mark>`);
        div.innerHTML = `<strong>${res.chapter}</strong><p>${highlightedText}</p>`;
        
        // Clicking takes you exactly to that sentence
        div.onclick = () => {
            rendition.display(res.cfi);
            closeAllModals();
        };
        resultsContainer.appendChild(div);
    });
};

// --- HTML EDITOR & FIND/REPLACE ---
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
        // Creates a global regex to replace all instances in the textarea
        const regex = new RegExp(findText, 'g');
        textarea.value = textarea.value.replace(regex, replaceText);
    } catch (e) {
        alert("Invalid Regex / Search string.");
    }
};

window.applyHTML = function() {
    const contents = rendition.getContents()[0];
    if(contents) {
        contents.document.body.innerHTML = document.getElementById('html-textarea').value;
        closeEditor();
    }
};

window.closeEditor = function() { document.getElementById('html-editor').classList.remove('active'); };
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }

// --- BOOKMARKS ---
window.saveBookmark = function() { /* Previous Bookmark logic here */ alert("Bookmark Saved!"); }
window.loadBookmarksList = function() { /* Previous Bookmark List logic here */ }

// INIT
loadLibrary();
