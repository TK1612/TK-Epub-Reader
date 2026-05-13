/**
 * Editor Workspace Module
 * Handles the core editor environment: CodeMirror layout, workspace management,
 * file tree display, and loading files into the editor.
 */

// Global state variables for the editor
window.activeZipEditor = null;
window.activeEditingPath = null;
window.activeBookIdForEditor = null;
window.cmEditor = null; 
window.originalEpubBuffer = null; 
window.currentOpfPath = null;
window.currentNcxPath = null;

// Properly extend window.showView from ui.js
const originalShowView = window.showView;
window.showView = function(viewId) {
    // 1. Update the UI and active screens
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(viewId + '-view');
    if (targetView) targetView.classList.add('active');
    
    history.pushState({ view: viewId }, '', '#' + viewId);
    let title = "Library";
    if (viewId === 'bookmarks') title = "Bookmarks";
    if (viewId === 'editor') title = "Edit Book";
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.innerText = title;

    // 2. Load data when switching tabs
    if (viewId === 'bookmarks') {
        if (typeof window.loadBookmarksList === 'function') window.loadBookmarksList();
    } else if (viewId === 'library') {
        if (typeof window.loadLibrary === 'function') window.loadLibrary(1);
    } else if (viewId === 'editor') {
        document.getElementById('editor-setup').style.display = 'block';
        document.getElementById('editor-workspace').style.display = 'none';
        document.getElementById('editor-main-toolbar').style.display = 'none';
        if (typeof window.loadEditorBookList === 'function') window.loadEditorBookList(1);
    }
    
    // 3. Close editor safety check
    if (viewId !== 'editor' && window.activeZipEditor !== null) {
        window.closeEditorWorkspace();
    }

    // 4. Auto-close sidebar on mobile devices for better UI
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
};

// Note: loadEditorBookList is now in js/ui/library/editor-list.js
// It is loaded as a module and attached to window via js/ui/library/index.js

/**
 * Opens the editor workspace for a specific book
 * Extracts EPUB from IndexedDB, initializes JSZip, and displays file tree
 * @param {string} bookId - The book ID (key in localforage)
 * @param {string} bookTitle - The book title for display
 * @returns {Promise<void>}
 */
// launchEditor is an alias for openEditorWorkspace (backward compatibility)
// Defined after openEditorWorkspace to ensure it exists
window.launchEditor = function(bookId) {
    if (typeof window.openEditorWorkspace === 'function') {
        // Get book title from localforage
        localforage.getItem(bookId).then(bookData => {
            const bookTitle = bookData ? bookData.title : "Unknown";
            window.openEditorWorkspace(bookId, bookTitle);
        });
    }
};

window.openEditorWorkspace = async function(bookId, bookTitle) {
    window.activeBookIdForEditor = bookId;
    document.getElementById('editor-setup').style.display = 'none';
    document.getElementById('editor-workspace').style.display = 'flex'; 
    document.getElementById('editor-main-toolbar').style.display = 'flex'; 
    
    if (!window.cmEditor) {
        window.cmEditor = CodeMirror.fromTextArea(document.getElementById('raw-code-editor'), {
            lineNumbers: true, mode: "htmlmixed",
            theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'material-darker' : 'default',
            lineWrapping: true
        });
    }

    const fileListEl = document.getElementById('editor-file-list');
    fileListEl.innerHTML = '<div style="padding:15px; color:gray;">Extracting EPUB Archive...</div>';
    window.cmEditor.setValue("");
    document.getElementById('editing-file-name').innerText = "Loading...";

    try {
        const bookData = await localforage.getItem(bookId);
        window.originalEpubBuffer = bookData.buffer; 
        const zip = new JSZip();
        window.activeZipEditor = await zip.loadAsync(bookData.buffer);
        window.refreshFileTree();
        document.getElementById('editing-file-name').innerText = "Workspace Ready: " + bookTitle;
        setTimeout(() => window.cmEditor.refresh(), 100);
    } catch (error) {
        fileListEl.innerHTML = '<div style="padding:15px; color:red;">Error extracting file.</div>';
    }
};

/**
 * Refreshes the file tree display in the editor workspace
 * Categorizes files into Text, Styles, Images, Fonts, and Miscellaneous
 * @returns {void}
 */
window.refreshFileTree = function() {
    const fileListEl = document.getElementById('editor-file-list');
    const categories = { Text: [], Styles: [], Images: [], Fonts: [], Miscellaneous: [] };
    
    Object.keys(window.activeZipEditor.files).forEach(path => {
        if (window.activeZipEditor.files[path].dir) return; 
        const lowerPath = path.toLowerCase();
        if (lowerPath.match(/\.(html|xhtml|htm)$/)) categories.Text.push(path);
        else if (lowerPath.match(/\.(css)$/)) categories.Styles.push(path);
        else if (lowerPath.match(/\.(png|jpe?g|gif|svg|webp)$/)) categories.Images.push(path);
        else if (lowerPath.match(/\.(ttf|otf|woff2?)$/)) categories.Fonts.push(path);
        else categories.Miscellaneous.push(path);
    });

    fileListEl.innerHTML = ''; 
    Object.keys(categories).forEach(catName => {
        if (categories[catName].length === 0) return; 
        let catIcon = 'ph-folder';
        if (catName === 'Text') catIcon = 'ph-text-t';
        if (catName === 'Styles') catIcon = 'ph-paint-brush';
        if (catName === 'Images') catIcon = 'ph-image';
        if (catName === 'Fonts') catIcon = 'ph-text-aa';
        
        const group = document.createElement('div');
        group.className = 'folder-group';
        const header = document.createElement('div');
        header.className = 'folder-header open'; 
        header.innerHTML = `<i class="ph ph-caret-right"></i> <i class="ph ${catIcon}" style="color:var(--accent);"></i> ${catName} (${categories[catName].length})`;
        const content = document.createElement('div');
        content.className = 'folder-content open';

        header.onclick = () => { header.classList.toggle('open'); content.classList.toggle('open'); };
        
        categories[catName].forEach(path => {
            const li = document.createElement('div');
            li.className = 'file-tree-item';
            let fileIcon = 'ph-file-code';
            if (catName === 'Styles') fileIcon = 'ph-file-css';
            else if (catName === 'Images') fileIcon = 'ph-image';
            const fileNameOnly = path.split('/').pop();
            li.innerHTML = `<i class="ph ${fileIcon}"></i> ${fileNameOnly}`;
            li.title = path; 
            li.onclick = () => window.loadFileIntoEditor(path, li);
            content.appendChild(li);
        });
        
        group.appendChild(header);
        group.appendChild(content);
        fileListEl.appendChild(group);
    });
};

/**
 * Loads a file from the EPUB zip into the CodeMirror editor
 * Handles different file types: HTML, CSS, images, fonts
 * @param {string} path - File path within the EPUB
 * @param {HTMLElement} liElement - The clicked list item element (to highlight)
 * @returns {Promise<void>}
 */
window.loadFileIntoEditor = async function(path, liElement) {
    if (!window.activeZipEditor) return;
    document.querySelectorAll('.file-tree-item').forEach(el => el.classList.remove('active-file'));
    if (liElement) liElement.classList.add('active-file');
    document.getElementById('editing-file-name').innerText = path;
    window.activeEditingPath = path;

    const cmWrapper = document.getElementById('codemirror-wrapper');
    const imgWrapper = document.getElementById('image-viewer-wrapper');
    const imgElement = document.getElementById('image-viewer');

    try {
        const fileObj = window.activeZipEditor.file(path);
        if (path.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
            cmWrapper.style.display = 'none';
            imgWrapper.style.display = 'flex';
            const uint8Array = await fileObj.async("uint8array");
            const blob = new Blob([uint8Array]);
            imgElement.src = URL.createObjectURL(blob);
            return;
        }

        imgWrapper.style.display = 'none';
        cmWrapper.style.display = 'flex';
        setTimeout(() => window.cmEditor.refresh(), 10);
        window.cmEditor.setValue("Extracting file content...");
        
        if (path.match(/\.(ttf|otf|woff2?)$/i)) return window.cmEditor.setValue("Binary font file selected. Viewing/Editing not supported.");
        
        const textContent = await fileObj.async("string");
        window.cmEditor.setValue(textContent);
        if (path.match(/\.(css)$/)) window.cmEditor.setOption("mode", "css");
        else if (path.endsWith('.opf') || path.endsWith('.ncx')) window.cmEditor.setOption("mode", "xml");
        else window.cmEditor.setOption("mode", "htmlmixed");
    } catch (error) { window.cmEditor.setValue("Error reading file content."); }
};

/**
 * Closes the editor workspace and resets all editor state
 * Clears active ZIP, editing path, book ID, and original buffer
 * @returns {void}
 */
window.closeEditorWorkspace = function() {
    window.activeZipEditor = null;
    window.activeEditingPath = null;
    window.activeBookIdForEditor = null;
    window.originalEpubBuffer = null;
    document.getElementById('editor-setup').style.display = 'block';
    document.getElementById('editor-workspace').style.display = 'none';
    document.getElementById('editor-main-toolbar').style.display = 'none';
};
