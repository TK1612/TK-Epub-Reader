window.activeZipEditor = null;
window.activeEditingPath = null;
window.activeBookIdForEditor = null;

const originalShowView = window.showView;
window.showView = function(viewId) {
    if (typeof originalShowView === 'function') {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewId + '-view');
        if(targetView) targetView.classList.add('active');
        
        history.pushState({ view: viewId }, '', '#' + viewId);
        
        let title = "Library";
        if (viewId === 'bookmarks') title = "Bookmarks";
        if (viewId === 'editor') title = "Edit Book";
        document.getElementById('page-title').innerText = title;
    }

    if (viewId === 'editor') {
        document.getElementById('editor-setup').style.display = 'block';
        document.getElementById('editor-workspace').style.display = 'none';
        loadEditorBookList();
    }
    
    if (viewId !== 'editor' && window.activeZipEditor !== null) {
        closeEditorWorkspace();
    }
};

window.loadEditorBookList = async function() {
    const grid = document.getElementById('editor-book-list');
    if (!grid) return;
    grid.innerHTML = '';
    
    await localforage.iterate(function(value, key) {
        const coverImg = value.cover ? value.cover : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <img src="${coverImg}" class="book-cover">
            <div class="book-info">
                <div class="book-title" title="${value.title}">${value.title}</div>
                <div style="font-size: 12px; color: var(--accent); margin-top: 4px;">Click to extract & edit</div>
            </div>
        `;

        card.onclick = () => {
            openEditorWorkspace(key, value.title);
        };
        grid.appendChild(card);
    });
};

window.openEditorWorkspace = async function(bookId, bookTitle) {
    window.activeBookIdForEditor = bookId;
    document.getElementById('editor-setup').style.display = 'none';
    document.getElementById('editor-workspace').style.display = 'flex'; // Uses Flex now instead of Block
    
    const fileListEl = document.getElementById('editor-file-list');
    fileListEl.innerHTML = '<li style="padding:10px; color:gray;">Extracting EPUB Archive...</li>';
    document.getElementById('raw-code-editor').value = "";
    document.getElementById('editing-file-name').innerText = "Loading...";

    try {
        const bookData = await localforage.getItem(bookId);
        const zip = new JSZip();
        
        window.activeZipEditor = await zip.loadAsync(bookData.buffer);
        fileListEl.innerHTML = ''; 
        
        const editableFiles = Object.keys(window.activeZipEditor.files).filter(path => {
            return !window.activeZipEditor.files[path].dir && 
                   (path.endsWith('.html') || path.endsWith('.htm') || path.endsWith('.xhtml') || path.endsWith('.css') || path.endsWith('.opf') || path.endsWith('.ncx'));
        });

        editableFiles.forEach(path => {
            const li = document.createElement('li');
            li.className = 'file-tree-item';
            
            let icon = 'ph-file-code';
            if (path.endsWith('.css')) icon = 'ph-file-css';
            else if (path.endsWith('.html') || path.endsWith('.xhtml')) icon = 'ph-file-html';

            li.innerHTML = `<i class="ph ${icon}"></i> ${path}`;
            li.onclick = () => loadFileIntoEditor(path, li);
            fileListEl.appendChild(li);
        });

        document.getElementById('editing-file-name').innerText = "Workspace Ready: " + bookTitle;

    } catch (error) {
        console.error("Failed to unzip book:", error);
        fileListEl.innerHTML = '<li style="padding:10px; color:red;">Error extracting file.</li>';
    }
};

window.loadFileIntoEditor = async function(path, liElement) {
    if (!window.activeZipEditor) return;

    document.querySelectorAll('.file-tree-item').forEach(el => el.classList.remove('active-file'));
    if (liElement) liElement.classList.add('active-file');
    
    document.getElementById('editing-file-name').innerText = path;
    document.getElementById('raw-code-editor').value = "Extracting file content...";
    window.activeEditingPath = path;

    try {
        const fileObj = window.activeZipEditor.file(path);
        const textContent = await fileObj.async("string");
        document.getElementById('raw-code-editor').value = textContent;
    } catch (error) {
        console.error("Could not read file:", error);
        document.getElementById('raw-code-editor').value = "Error reading file content.";
    }
};

// FIXED: The Core Repackaging Engine
window.saveEditedFile = async function() {
    if (!window.activeZipEditor || !window.activeEditingPath) {
        alert("Please open a file from the left sidebar first.");
        return;
    }

    const saveBtn = document.getElementById('save-file-btn');
    const originalHTML = saveBtn.innerHTML;
    
    // UI Loading State
    saveBtn.innerHTML = '<i class="ph ph-spinner"></i> Saving...';
    saveBtn.disabled = true;

    try {
        // 1. Get the newly edited code
        const newCode = document.getElementById('raw-code-editor').value;
        
        // 2. Inject it back into the target file in the JSZip memory archive
        window.activeZipEditor.file(window.activeEditingPath, newCode);
        
        // 3. Compress the entire ZIP back into an ArrayBuffer (This is the heavy lifting)
        const newEpubBuffer = await window.activeZipEditor.generateAsync({
            type: "arraybuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 } // Good balance of speed and file size
        });

        // 4. Fetch the original database entry to retain cover art, title, and ID
        const oldData = await localforage.getItem(window.activeBookIdForEditor);
        
        // 5. Swap the old buffer with the new edited buffer
        oldData.buffer = newEpubBuffer;
        
        // 6. Overwrite the database
        await localforage.setItem(window.activeBookIdForEditor, oldData);

        // 7. Clear location cache so the reader doesn't load stale, pre-edited pagination
        localStorage.removeItem('locations-' + window.activeBookIdForEditor);

        // Success UI
        saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Saved!';
        saveBtn.style.backgroundColor = 'var(--accent)';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.disabled = false;
            saveBtn.style.backgroundColor = '';
        }, 2000);

    } catch (error) {
        console.error("Save failed:", error);
        alert("Failed to save the book. Check console for details.");
        saveBtn.innerHTML = originalHTML;
        saveBtn.disabled = false;
    }
};

window.closeEditorWorkspace = function() {
    window.activeZipEditor = null;
    window.activeEditingPath = null;
    window.activeBookIdForEditor = null;
    
    document.getElementById('editor-setup').style.display = 'block';
    document.getElementById('editor-workspace').style.display = 'none';
};
