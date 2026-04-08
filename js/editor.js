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
        document.getElementById('editor-main-toolbar').style.display = 'none';
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
    document.getElementById('editor-workspace').style.display = 'flex'; 
    document.getElementById('editor-main-toolbar').style.display = 'flex'; 
    
    const fileListEl = document.getElementById('editor-file-list');
    fileListEl.innerHTML = '<div style="padding:15px; color:gray;">Extracting EPUB Archive...</div>';
    document.getElementById('raw-code-editor').value = "";
    document.getElementById('editing-file-name').innerText = "Loading...";

    try {
        const bookData = await localforage.getItem(bookId);
        const zip = new JSZip();
        window.activeZipEditor = await zip.loadAsync(bookData.buffer);
        
        // --- CATEGORIZATION ENGINE (CALIBRE STYLE) ---
        const categories = { Text: [], Styles: [], Images: [], Fonts: [], Miscellaneous: [] };
        
        Object.keys(window.activeZipEditor.files).forEach(path => {
            if (window.activeZipEditor.files[path].dir) return; // Skip folder metadata
            
            const lowerPath = path.toLowerCase();
            if (lowerPath.match(/\.(html|xhtml|htm)$/)) categories.Text.push(path);
            else if (lowerPath.match(/\.(css)$/)) categories.Styles.push(path);
            else if (lowerPath.match(/\.(png|jpe?g|gif|svg|webp)$/)) categories.Images.push(path);
            else if (lowerPath.match(/\.(ttf|otf|woff2?)$/)) categories.Fonts.push(path);
            else categories.Miscellaneous.push(path);
        });

        fileListEl.innerHTML = ''; // Clear loading text
        
        // Build the Accordion UI
        Object.keys(categories).forEach(catName => {
            if (categories[catName].length === 0) return; // Skip empty folders
            
            let catIcon = 'ph-folder';
            if (catName === 'Text') catIcon = 'ph-text-t';
            if (catName === 'Styles') catIcon = 'ph-paint-brush';
            if (catName === 'Images') catIcon = 'ph-image';
            if (catName === 'Fonts') catIcon = 'ph-text-aa';

            const group = document.createElement('div');
            group.className = 'folder-group';
            
            // Folder Header
            const header = document.createElement('div');
            header.className = 'folder-header open'; // Open by default
            header.innerHTML = `<i class="ph ph-caret-right"></i> <i class="ph ${catIcon}" style="color:var(--accent);"></i> ${catName} (${categories[catName].length})`;
            
            // Folder Content List
            const content = document.createElement('div');
            content.className = 'folder-content open';

            // Toggle logic
            header.onclick = () => {
                header.classList.toggle('open');
                content.classList.toggle('open');
            };

            // Add files to folder
            categories[catName].forEach(path => {
                const li = document.createElement('div');
                li.className = 'file-tree-item';
                
                let fileIcon = 'ph-file-code';
                if (catName === 'Styles') fileIcon = 'ph-file-css';
                else if (catName === 'Images') fileIcon = 'ph-image';

                // Display just the filename for cleaner UI, but keep path in logic
                const fileNameOnly = path.split('/').pop();
                
                li.innerHTML = `<i class="ph ${fileIcon}"></i> ${fileNameOnly}`;
                li.title = path; // Show full path on hover
                
                li.onclick = () => loadFileIntoEditor(path, li);
                content.appendChild(li);
            });

            group.appendChild(header);
            group.appendChild(content);
            fileListEl.appendChild(group);
        });

        document.getElementById('editing-file-name').innerText = "Workspace Ready: " + bookTitle;

    } catch (error) {
        console.error("Failed to unzip book:", error);
        fileListEl.innerHTML = '<div style="padding:15px; color:red;">Error extracting file.</div>';
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
        
        // Prevent trying to open Images or Fonts in the text editor
        if (path.match(/\.(png|jpe?g|gif|webp|ttf|otf|woff2?)$/i)) {
            document.getElementById('raw-code-editor').value = "Binary file selected. Text editing not supported for images or fonts.";
            return;
        }

        const textContent = await fileObj.async("string");
        document.getElementById('raw-code-editor').value = textContent;
    } catch (error) {
        console.error("Could not read file:", error);
        document.getElementById('raw-code-editor').value = "Error reading file content.";
    }
};

// NEW: Local Regex Find & Replace function
window.editorReplaceAll = function() {
    const findStr = document.getElementById('editor-find').value;
    const replaceStr = document.getElementById('editor-replace').value;
    const textarea = document.getElementById('raw-code-editor');
    
    if(!findStr) return;
    
    try {
        // Try parsing as Regex first
        const regex = new RegExp(findStr, 'g');
        textarea.value = textarea.value.replace(regex, replaceStr);
    } catch(e) {
        // If Regex fails (e.g. they typed a literal [ or *), fallback to standard string replace
        textarea.value = textarea.value.split(findStr).join(replaceStr);
    }
    
    // Quick flash effect to show it worked
    textarea.style.backgroundColor = 'var(--surface)';
    setTimeout(() => { textarea.style.backgroundColor = 'var(--bg-color)'; }, 200);
};

window.saveEditedFile = async function() {
    if (!window.activeZipEditor || !window.activeEditingPath) {
        alert("Please open a file from the left sidebar first.");
        return;
    }

    const saveBtn = document.getElementById('save-file-btn');
    const originalHTML = saveBtn.innerHTML;
    
    saveBtn.innerHTML = '<i class="ph ph-spinner"></i> Saving...';
    saveBtn.disabled = true;

    try {
        const newCode = document.getElementById('raw-code-editor').value;
        window.activeZipEditor.file(window.activeEditingPath, newCode);
        
        const newEpubBuffer = await window.activeZipEditor.generateAsync({
            type: "arraybuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 } 
        });

        const oldData = await localforage.getItem(window.activeBookIdForEditor);
        oldData.buffer = newEpubBuffer;
        
        await localforage.setItem(window.activeBookIdForEditor, oldData);
        localStorage.removeItem('locations-' + window.activeBookIdForEditor);

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
    document.getElementById('editor-main-toolbar').style.display = 'none';
};
