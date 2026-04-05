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
                    } catch(e) { console.warn("Could not extract cover."); }
                }

                const bookData = { id: bookId, title: title, buffer: buffer, cover: coverBase64 };
                await localforage.setItem(bookId, bookData);
                
                tempBook.destroy();
                resolve(); 
            }).catch(() => { tempBook.destroy(); resolve(); });
        });
    }

    window.loadLibrary();
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;
    event.target.value = ''; 
};

window.loadLibrary = async function() {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';
    
    localforage.iterate(function(value, key) {
        const coverImg = value.cover ? value.cover : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';
        
        let progressText = "Not Started";
        
        // Fetch saved progress data to get the chapter name ONLY
        const progressData = localStorage.getItem('progress-' + key);
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
            if (window.isDeleteMode) window.deleteBook(key, value.title);
            else window.openReader(key);
        };
        grid.appendChild(card);
    });
};

window.deleteBook = async function(bookId, bookTitle) {
    if(confirm(`Are you sure you want to permanently delete "${bookTitle}"?`)) {
        await localforage.removeItem(bookId);
        localStorage.removeItem('bookmark-' + bookId);
        localStorage.removeItem('progress-' + bookId);
        window.loadLibrary(); 
    }
};

window.loadBookmarksList = function() {
    const list = document.getElementById('bookmarks-list');
    if(!list) return;
    list.innerHTML = '';
    
    localforage.iterate(function(value, key) {
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
            list.appendChild(li);
        }
    });

    if (list.innerHTML === '') {
        list.innerHTML = '<p style="color:gray; padding:10px;">No reading progress saved yet.</p>';
    }
};
