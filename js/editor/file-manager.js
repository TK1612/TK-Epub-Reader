/**
 * Editor File Manager Module
 * Handles all file I/O operations: saving edited files, downloading
 * the compiled EPUB, reverting to original saves, managing the
 * selected files list, and adding outside files.
 */

/**
 * Opens the "Add File" modal for importing external files into EPUB
 * Clears previous selections and displays the modal
 * @returns {void}
 */
window.openAddFileModal = function() {
    if (!window.activeZipEditor) return;
    document.getElementById('add-outside-file-input').value = "";
    document.getElementById('selected-files-list').innerHTML = "";
    window.openEditorModal('editor-add-file-modal');
};

/**
 * Updates the list of selected files in the "Add File" modal
 * Displays file names with appropriate icons based on file type
 * @returns {void}
 */
window.updateSelectedFilesList = function() {
    const fileInput = document.getElementById('add-outside-file-input');
    const listEl = document.getElementById('selected-files-list');
    listEl.innerHTML = '';
    if (fileInput.files.length === 0) return;
    
    Array.from(fileInput.files).forEach(file => {
        const item = document.createElement('div');
        item.className = 'selected-file-item';
        let icon = 'ph-file';
        if (file.type.includes('image')) icon = 'ph-image';
        else if (file.type.includes('css')) icon = 'ph-file-css';
        else if (file.type.includes('html')) icon = 'ph-file-html';
        item.innerHTML = `<i class="ph ${icon}"></i> <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</span>`;
        listEl.appendChild(item);
    });
};

/**
 * Imports external files into the EPUB archive
 * Adds files to ZIP and updates OPF manifest with proper media types
 * @returns {Promise<void>}
 */
window.confirmAddOutsideFile = async function() {
    const fileInput = document.getElementById('add-outside-file-input');
    if (fileInput.files.length === 0) return alert("Please select at least one file.");
    
    const btn = document.getElementById('confirm-add-file-btn');
    const originalBtnText = btn.innerText;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Importing...';
    btn.disabled = true;

    const opfPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
    const baseFolder = opfPath ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    
    let xmlDoc = null;
    let manifest = null;
    if (opfPath) {
        const opfContent = await window.activeZipEditor.file(opfPath).async("string");
        xmlDoc = new DOMParser().parseFromString(opfContent, "application/xml");
        manifest = xmlDoc.getElementsByTagName("manifest")[0];
    }
    
    for (let i = 0; i < fileInput.files.length; i++) {
        const file = fileInput.files[i];
        let targetFolder = baseFolder;
        let mediaType = "application/octet-stream";
        
        if (file.type.includes('image')) { targetFolder += 'Images/'; mediaType = file.type; }
        else if (file.type.includes('css')) { targetFolder += 'Styles/'; mediaType = "text/css"; }
        else if (file.type.includes('html')) { targetFolder += 'Text/'; mediaType = "application/xhtml+xml"; }
        else if (file.type.includes('font') || file.name.match(/\.(ttf|otf|woff2?)$/i)) { targetFolder += 'Fonts/'; mediaType = "font/" + file.name.split('.').pop(); }
        
        const targetPath = targetFolder + file.name;
        const arrayBuffer = await file.arrayBuffer();
        window.activeZipEditor.file(targetPath, arrayBuffer);
        
        if (manifest) {
            const id = "file_" + Date.now() + "_" + i; 
            const item = xmlDoc.createElement("item");
            item.setAttribute("id", id);
            item.setAttribute("href", targetPath.replace(baseFolder, '')); 
            item.setAttribute("media-type", mediaType);
            manifest.appendChild(item);
        }
    }
    
    if (opfPath && xmlDoc) window.activeZipEditor.file(opfPath, new XMLSerializer().serializeToString(xmlDoc));
    await window.saveEditedFile();
    window.refreshFileTree();
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
    if (window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    alert(`Successfully imported and registered ${fileInput.files.length} file(s)!`);
};

/**
 * Reverts the EPUB to its original state when the editor was opened
 * Wipes all session edits and reloads the page
 * @returns {Promise<void>}
 */
window.revertToOriginalSave = async function() {
    if (!window.activeBookIdForEditor || !window.originalEpubBuffer) return;
    if (confirm("Are you sure? This will wipe all edits made during this session and restore the book to how it was when you opened the Editor.")) {
        const oldData = await localforage.getItem(window.activeBookIdForEditor);
        oldData.buffer = window.originalEpubBuffer;
        await localforage.setItem(window.activeBookIdForEditor, oldData);
        alert("Reverted! The page will now reload.");
        location.reload();
    }
};

/**
 * Downloads the currently edited EPUB as a file
 * Generates ZIP blob and triggers download with proper filename
 * @returns {Promise<void>}
 */
window.downloadEditedEpub = async function() {
    if (!window.activeZipEditor || !window.activeBookIdForEditor) return alert("Open a book first.");

    const btn = document.getElementById('download-epub-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Exporting...';
    btn.disabled = true;

    try {
        if (window.cmEditor && window.activeEditingPath) {
            if (!window.activeEditingPath.match(/\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?)$/i)) {
                window.activeZipEditor.file(window.activeEditingPath, window.cmEditor.getValue());
            }
        }

        const blob = await window.activeZipEditor.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });

        let filename = "Edited_Book.epub";
        try {
            const bookData = await localforage.getItem(window.activeBookIdForEditor);
            if (bookData && bookData.title) {
                filename = bookData.title.replace(/[<>:"/\\|?*]+/g, '').trim() + ".epub";
            }
        } catch (e) {}

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        btn.innerHTML = '<i class="ph ph-check-circle"></i> Exported!';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        console.error(err);
        alert("Error exporting EPUB.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

/**
 * Saves the currently edited file back to the EPUB and IndexedDB
 * Updates ZIP content, regenerates buffer, and saves to localforage
 * @returns {Promise<void>}
 */
window.saveEditedFile = async function() {
    if (!window.activeZipEditor || !window.activeEditingPath) return alert("Open a file first.");
    
    if (window.activeEditingPath.match(/\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?)$/i)) {
        return alert("Cannot save edits to binary image or font files.");
    }

    const saveBtn = document.getElementById('save-file-btn');
    const originalHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="ph ph-spinner"></i> Saving...';
    saveBtn.disabled = true;

    try {
        window.activeZipEditor.file(window.activeEditingPath, window.cmEditor.getValue());
        const newEpubBuffer = await window.activeZipEditor.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
        const oldData = await localforage.getItem(window.activeBookIdForEditor);
        oldData.buffer = newEpubBuffer;
        await localforage.setItem(window.activeBookIdForEditor, oldData);
        localStorage.removeItem('locations-' + window.activeBookIdForEditor);

        saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Saved!';
        saveBtn.style.backgroundColor = 'var(--accent)';
        setTimeout(() => { saveBtn.innerHTML = originalHTML; saveBtn.disabled = false; saveBtn.style.backgroundColor = ''; }, 2000);
    } catch (error) {
        alert("Failed to save.");
        saveBtn.innerHTML = originalHTML;
        saveBtn.disabled = false;
    }
};
