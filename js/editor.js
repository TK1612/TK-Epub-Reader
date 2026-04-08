// A global variable to hold the JSZip instance ONLY when editing
window.activeZipEditor = null;
window.activeEditingPath = null;
window.activeBookIdForEditor = null;

// Ensure showView in your ui.js is updated to handle the 'editor' route if it doesn't automatically
const originalShowView = window.showView;
window.showView = function(viewId) {
    if (typeof originalShowView === 'function') {
        // Run your existing showView logic
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewId + '-view');
        if(targetView) targetView.classList.add('active');
        
        history.pushState({ view: viewId }, '', '#' + viewId);
        
        let title = "Library";
        if (viewId === 'bookmarks') title = "Bookmarks";
        if (viewId === 'editor') title = "Edit Book";
        document.getElementById('page-title').innerText = title;
    }

    // If we navigate TO the editor, load the books
    if (viewId === 'editor') {
        document.getElementById('editor-setup').style.display = 'block';
        document.getElementById('editor-workspace').style.display = 'none';
        loadEditorBookList();
    }
    
    // If we navigate AWAY from the editor, safely garbage collect the ZIP memory
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
    
    const fileListEl = document.getElementById('editor-file-list');
    fileListEl.innerHTML = '<li style="padding:10px; color:gray;">Extracting EPUB Archive...</li>';
    document.getElementById('raw-code-editor').value = "";
    document.getElementById('editing-file-name').innerText = "Loading...";

    try {
        const bookData = await localforage.getItem(bookId);
        const zip = new JSZip();
        
        // This is the "Lazy Load". It only unzips into memory right now.
        window.activeZipEditor = await zip.loadAsync(bookData.buffer);
        
        fileListEl.innerHTML = ''; // Clear loading text
        
        // Filter for files we can actually edit (HTML, XML, CSS)
        const editableFiles = Object.keys(window.activeZipEditor.files).filter(path => {
            return !window.activeZipEditor.files[path].dir && 
                   (path.endsWith('.html') || path.endsWith('.htm') || path.endsWith('.xhtml') || path.endsWith('.css') || path.endsWith('.opf') || path.endsWith('.ncx'));
        });

        editableFiles.forEach(path => {
            const li = document.createElement('li');
            li.className = 'file-tree-item';
            
            // Add a little icon based on file type
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

    // UI Updates
    document.querySelectorAll('.file-tree-item').forEach(el => el.classList.remove('active-file'));
    if (liElement) liElement.classList.add('active-file');
    
    document.getElementById('editing-file-name').innerText = path;
    document.getElementById('raw-code-editor').value = "Extracting file content...";
    window.activeEditingPath = path;

    try {
        // Extract JUST this specific file as a text string from the ZIP memory
        const fileObj = window.activeZipEditor.file(path);
        const textContent = await fileObj.async("string");
        document.getElementById('raw-code-editor').value = textContent;
    } catch (error) {
        console.error("Could not read file:", error);
        document.getElementById('raw-code-editor').value = "Error reading file content.";
    }
};

window.saveEditedFile = async function() {
    alert("Saving logic will go here! This will take the text, repackage the zip, and save to localForage.");
    // We will build the repackaging function in the next step!
};

window.closeEditorWorkspace = function() {
    // Garbage collection: Nuke the ZIP from memory when we close it
    window.activeZipEditor = null;
    window.activeEditingPath = null;
    window.activeBookIdForEditor = null;
    
    document.getElementById('editor-setup').style.display = 'block';
    document.getElementById('editor-workspace').style.display = 'none';
};
