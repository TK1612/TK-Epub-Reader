// --- GLOBAL DISPLAY SETTINGS ---
window.librarySortOrder = 'newest';
window.librarySearchQuery = '';

window.toggleUniversalSearch = function() {
    const isEditor = document.getElementById('editor-view').classList.contains('active');
    const containerId = isEditor ? 'editor-search-container' : 'library-search-container';
    const inputId = isEditor ? 'editor-search-input' : 'library-search-input';
    
    const container = document.getElementById(containerId);
    if (container.style.display === 'none') {
        container.style.display = 'block';
        document.getElementById(inputId).focus();
    } else {
        container.style.display = 'none';
        document.getElementById(inputId).value = '';
        window.librarySearchQuery = '';
        if(isEditor) window.loadEditorBookList(1);
        else window.loadLibrary(1);
    }
};

window.applyUniversalSearch = function() {
    const isEditor = document.getElementById('editor-view').classList.contains('active');
    const inputId = isEditor ? 'editor-search-input' : 'library-search-input';
    window.librarySearchQuery = document.getElementById(inputId).value.toLowerCase();
    
    if(isEditor) window.loadEditorBookList(1);
    else window.loadLibrary(1);
};

window.openLibrarySettings = function() {
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('library-sort-select').value = window.librarySortOrder;
    document.getElementById('library-settings-modal').classList.add('active');
};

window.applyLibrarySort = function() {
    window.librarySortOrder = document.getElementById('library-sort-select').value;
    const isEditor = document.getElementById('editor-view').classList.contains('active');
    
    if(isEditor) window.loadEditorBookList(1);
    else window.loadLibrary(1);
};

window.handleUpload = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadBtn = document.querySelector('.upload-btn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();
        const tempBook = ePub(buffer);
        
        await new Promise((resolve) => {
            tempBook.ready.then(async () => {
                let title = file.name.replace(/\.epub$/i, '');
                try {
                    const meta = tempBook.packaging.metadata;
                    if (meta && meta.title) title = meta.title;
                } catch(e) {}
                
                const bookId = "novel_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11); 
                
                let coverBase64 = "";
                try {
                    const coverUrl = await tempBook.coverUrl();
                    if (coverUrl) {
                        const response = await fetch(coverUrl);
                        const blob = await response.blob();
                        coverBase64 = await new Promise((res) => {
                            const reader = new FileReader();
                            reader.onloadend = () => res(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                } catch(e) {
                    console.warn("No cover found or EPUB manifest is malformed. Skipping cover.");
                }

                const bookData = { id: bookId, title: title, buffer: buffer, cover: coverBase64 };
                await localforage.setItem(bookId, bookData);
                
                tempBook.destroy();
                resolve(); 
            }).catch(async (err) => {
                console.warn("EPUB.js failed to parse. Force saving as raw file...", err);
                const bookId = "novel_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
                let fallbackTitle = file.name.replace(/\.epub$/i, '');
                const bookData = { id: bookId, title: fallbackTitle, buffer: buffer, cover: "" };
                
                await localforage.setItem(bookId, bookData);
                tempBook.destroy();
                resolve();
            });
        });
    }

    await window.loadLibrary(1); // Reset to page 1 after new upload
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;
    event.target.value = ''; 
};


let isLibraryLoading = false;
let currentLibraryPage = 1;
const BOOKS_PER_PAGE = 100;

window.loadLibrary = async function(page = 1) {
    if (isLibraryLoading) return; 
    isLibraryLoading = true;
    currentLibraryPage = page;
    
    try {
        const grid = document.getElementById('library-grid');
        const paginationContainer = document.getElementById('library-pagination');
        if (!grid) return;
        
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 32px; color: var(--accent);"></i><p style="color: var(--text-muted); margin-top: 10px;">Loading library...</p></div>';
        
        let catalog = [];
        
        // RAM-SAFE CATALOG EXTRACTION
        await localforage.iterate(function(value, key) {
            if (!key.startsWith('bookmark-') && !key.startsWith('progress-') && !key.startsWith('locations-')) {
                catalog.push({ key: key, title: value.title || "Unknown" });
            }
        });
        
        catalog.reverse(); // Default to Newest First

        // FILTER: Search Logic
        if (window.librarySearchQuery) {
            catalog = catalog.filter(item => item.title.toLowerCase().includes(window.librarySearchQuery));
        }

        // SORT: Apply Sorting
        if (window.librarySortOrder === 'az') {
            catalog.sort((a, b) => a.title.localeCompare(b.title));
        } else if (window.librarySortOrder === 'za') {
            catalog.sort((a, b) => b.title.localeCompare(a.title));
        }

        // PAGINATION MATH
        const totalPages = Math.ceil(catalog.length / BOOKS_PER_PAGE) || 1;
        if (currentLibraryPage > totalPages) currentLibraryPage = totalPages;

        const startIndex = (currentLibraryPage - 1) * BOOKS_PER_PAGE;
        const pageItems = catalog.slice(startIndex, startIndex + BOOKS_PER_PAGE);

        const cards = []; 
        
        // ONLY FETCH HEAVY BUFFER DATA FOR THE 100 ITEMS ON THIS EXACT PAGE!
        for (let item of pageItems) {
            const value = await localforage.getItem(item.key);
            if (!value) continue;

            const coverImg = value.cover ? value.cover : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';
            
            let progressText = "Not Started";
            const progressData = localStorage.getItem('progress-' + item.key);
            if (progressData) {
                try {
                    const parsed = JSON.parse(progressData);
                    progressText = parsed.chapter || "Reading...";
                    if (progressText === value.title) progressText = "Reading...";
                } catch(e) {}
            }

            const card = document.createElement('div');
            card.className = 'book-card';
            card.innerHTML = `
                <div class="delete-overlay">
                    <i class="ph ph-trash"></i>
                    <span>Click to Delete</span>
                </div>
                <img src="${coverImg}" class="book-cover">
                <div class="book-info">
                    <div class="book-title" title="${value.title}">${value.title}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${progressText}">
                        ${progressText}
                    </div>
                </div>
            `;

            card.onclick = () => {
                if (window.isDeleteMode) window.deleteBook(item.key, value.title);
                else window.openReader(item.key);
            };
            cards.push(card);
        }
        
        grid.innerHTML = '';
        cards.forEach(card => grid.appendChild(card));
        
        // DRAW GLASS PAGINATION UI
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    const btn = document.createElement('button');
                    btn.className = `page-btn ${i === currentLibraryPage ? 'active' : ''}`;
                    btn.innerText = i;
                    btn.onclick = () => window.loadLibrary(i);
                    paginationContainer.appendChild(btn);
                }
            }
        }
        
    } finally {
        isLibraryLoading = false; 
    }
};

window.deleteBook = async function(bookId, bookTitle) {
    if(confirm(`Are you sure you want to permanently delete "${bookTitle}"?`)) {
        await localforage.removeItem(bookId);
        localStorage.removeItem('bookmark-' + bookId);
        localStorage.removeItem('progress-' + bookId);
        localStorage.removeItem('locations-' + bookId); 
        window.loadLibrary(currentLibraryPage); 
    }
};

let isBookmarksLoading = false;

window.loadBookmarksList = async function() {
    if (isBookmarksLoading) return;
    isBookmarksLoading = true;
    
    try {
        const list = document.getElementById('bookmarks-list');
        if(!list) return;
        
        const items = [];
        
        await localforage.iterate(function(value, key) {
            const savedCfi = localStorage.getItem('bookmark-' + key);
            if (savedCfi) {
                let progressText = "Auto-saved progress available";
                const progressData = localStorage.getItem('progress-' + key);
                if(progressData) {
                    try {
                        const parsed = JSON.parse(progressData);
                        progressText = parsed.chapter === value.title ? "Reading" : parsed.chapter;
                    } catch(e) {}
                }

                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <strong style="color:var(--accent); display:block; margin-bottom:4px;">${value.title}</strong>
                    <span style="font-size:12px; color:var(--text-muted);">${progressText}</span>
                `;
                li.onclick = () => {
                    window.showView('library');
                    window.openReader(key);
                };
                items.push(li);
            }
        });

        list.innerHTML = '';
        items.forEach(li => list.appendChild(li));
        
        if (list.innerHTML === '') {
            list.innerHTML = '<p style="color:gray; padding:10px;">No reading progress saved yet.</p>';
        }
    } finally {
        isBookmarksLoading = false;
    }
};
