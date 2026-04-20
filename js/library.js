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

    await window.loadLibrary(1); 
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
        
        await localforage.iterate(function(value, key) {
            if (!key.startsWith('bookmark-') && !key.startsWith('progress-') && !key.startsWith('locations-')) {
                catalog.push({ key: key, title: value.title || "Unknown" });
            }
        });
        
        catalog.reverse(); 

        if (window.librarySearchQuery) {
            catalog = catalog.filter(item => item.title.toLowerCase().includes(window.librarySearchQuery));
        }

        if (window.librarySortOrder === 'az') {
            catalog.sort((a, b) => a.title.localeCompare(b.title));
        } else if (window.librarySortOrder === 'za') {
            catalog.sort((a, b) => b.title.localeCompare(a.title));
        }

        const totalPages = Math.ceil(catalog.length / BOOKS_PER_PAGE) || 1;
        if (currentLibraryPage > totalPages) currentLibraryPage = totalPages;

        const startIndex = (currentLibraryPage - 1) * BOOKS_PER_PAGE;
        const pageItems = catalog.slice(startIndex, startIndex + BOOKS_PER_PAGE);

        const cards = []; 
        
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
            card.setAttribute('data-id', item.key); // Attached Key for Batch Selecting

            // Re-apply selection state if moving between pages while deleting
            if (window.isDeleteMode && window.selectedForDeletion && window.selectedForDeletion.has(item.key)) {
                card.classList.add('selected-for-delete');
            }

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
                if (window.isDeleteMode) window.toggleBookSelection(item.key, card);
                else window.openReader(item.key);
            };
            cards.push(card);
        }
        
        grid.innerHTML = '';
        cards.forEach(card => grid.appendChild(card));
        
        // Re-apply visual delete mode state to grid if moving pages
        if (window.isDeleteMode) grid.classList.add('delete-mode');
        else grid.classList.remove('delete-mode');

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


// --- BATCH DELETE LOGIC ---
window.selectedForDeletion = new Set();

window.toggleDeleteMode = function() {
    window.isDeleteMode = !window.isDeleteMode;
    const grid = document.getElementById('library-grid');
    const btn = document.getElementById('delete-mode-btn');
    const batchBar = document.getElementById('batch-delete-bar');
    
    if (window.isDeleteMode) {
        grid.classList.add('delete-mode');
        btn.classList.add('delete-btn-active');
        window.selectedForDeletion = new Set(); // Reset on start
        if (batchBar) batchBar.classList.remove('hidden');
        window.updateBatchDeleteCount();
    } else {
        grid.classList.remove('delete-mode');
        btn.classList.remove('delete-btn-active');
        window.selectedForDeletion.clear();
        if (batchBar) batchBar.classList.add('hidden');
        document.querySelectorAll('.book-card.selected-for-delete').forEach(c => c.classList.remove('selected-for-delete'));
    }
};

window.updateBatchDeleteCount = function() {
    const countSpan = document.getElementById('batch-delete-count');
    if (countSpan) countSpan.innerText = `${window.selectedForDeletion.size} Selected`;
};

window.toggleBookSelection = function(bookId, cardElement) {
    if (window.selectedForDeletion.has(bookId)) {
        window.selectedForDeletion.delete(bookId);
        cardElement.classList.remove('selected-for-delete');
    } else {
        window.selectedForDeletion.add(bookId);
        cardElement.classList.add('selected-for-delete');
    }
    window.updateBatchDeleteCount();
};

window.selectAllForDeletion = function() {
    const allCards = document.querySelectorAll('#library-grid .book-card');
    if (allCards.length === 0) return;

    // Check if ALL currently visible books are selected
    const allSelected = Array.from(allCards).every(card => card.classList.contains('selected-for-delete'));

    if (allSelected) {
        // Deselect all on this page
        allCards.forEach(card => {
            const bookId = card.getAttribute('data-id');
            window.selectedForDeletion.delete(bookId);
            card.classList.remove('selected-for-delete');
        });
    } else {
        // Select all on this page
        allCards.forEach(card => {
            const bookId = card.getAttribute('data-id');
            window.selectedForDeletion.add(bookId);
            card.classList.add('selected-for-delete');
        });
    }
    window.updateBatchDeleteCount();
};

window.executeBatchDelete = async function() {
    if (window.selectedForDeletion.size === 0) return alert("Select at least one book to delete.");
    
    if (confirm(`Are you sure you want to permanently delete ${window.selectedForDeletion.size} book(s)?`)) {
        const btn = document.getElementById('batch-delete-btn');
        if (btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
        
        for (let bookId of window.selectedForDeletion) {
            await localforage.removeItem(bookId);
            localStorage.removeItem('bookmark-' + bookId);
            localStorage.removeItem('progress-' + bookId);
            localStorage.removeItem('locations-' + bookId);
        }
        
        window.selectedForDeletion.clear();
        window.toggleDeleteMode(); 
        window.loadLibrary(currentLibraryPage);
        if (btn) btn.innerHTML = 'Delete';
    }
};
