window.activeZipEditor = null;
window.activeEditingPath = null;
window.activeBookIdForEditor = null;
window.cmEditor = null; // CodeMirror Instance

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

        card.onclick = () => openEditorWorkspace(key, value.title);
        grid.appendChild(card);
    });
};

window.openEditorWorkspace = async function(bookId, bookTitle) {
    window.activeBookIdForEditor = bookId;
    document.getElementById('editor-setup').style.display = 'none';
    document.getElementById('editor-workspace').style.display = 'flex'; 
    document.getElementById('editor-main-toolbar').style.display = 'flex'; 
    
    // Initialize CodeMirror if it hasn't been created yet
    if (!window.cmEditor) {
        window.cmEditor = CodeMirror.fromTextArea(document.getElementById('raw-code-editor'), {
            lineNumbers: true,
            mode: "htmlmixed",
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
        const zip = new JSZip();
        window.activeZipEditor = await zip.loadAsync(bookData.buffer);
        
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

            header.onclick = () => {
                header.classList.toggle('open');
                content.classList.toggle('open');
            };

            categories[catName].forEach(path => {
                const li = document.createElement('div');
                li.className = 'file-tree-item';
                
                let fileIcon = 'ph-file-code';
                if (catName === 'Styles') fileIcon = 'ph-file-css';
                else if (catName === 'Images') fileIcon = 'ph-image';

                const fileNameOnly = path.split('/').pop();
                li.innerHTML = `<i class="ph ${fileIcon}"></i> ${fileNameOnly}`;
                li.title = path; 
                
                li.onclick = () => loadFileIntoEditor(path, li);
                content.appendChild(li);
            });

            group.appendChild(header);
            group.appendChild(content);
            fileListEl.appendChild(group);
        });

        document.getElementById('editing-file-name').innerText = "Workspace Ready: " + bookTitle;
        setTimeout(() => window.cmEditor.refresh(), 100);

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
    window.cmEditor.setValue("Extracting file content...");
    window.activeEditingPath = path;

    try {
        const fileObj = window.activeZipEditor.file(path);
        
        if (path.match(/\.(png|jpe?g|gif|webp|ttf|otf|woff2?)$/i)) {
            window.cmEditor.setValue("Binary file selected. Text editing not supported for images or fonts.");
            return;
        }

        const textContent = await fileObj.async("string");
        window.cmEditor.setValue(textContent);
        
        // Set syntax highlighting mode dynamically
        if(path.endsWith('.css')) window.cmEditor.setOption("mode", "css");
        else if(path.endsWith('.opf') || path.endsWith('.ncx')) window.cmEditor.setOption("mode", "xml");
        else window.cmEditor.setOption("mode", "htmlmixed");

    } catch (error) {
        console.error("Could not read file:", error);
        window.cmEditor.setValue("Error reading file content.");
    }
};

// FEATURE: Local Regex Find & Replace (Using CodeMirror)
window.editorReplaceAll = function() {
    if (!window.cmEditor) return;
    
    const findStr = document.getElementById('editor-find').value;
    const replaceStr = document.getElementById('editor-replace').value;
    const useRegex = document.getElementById('editor-use-regex').checked;
    
    if(!findStr) return;
    
    let content = window.cmEditor.getValue();
    
    if (useRegex) {
        try {
            const regex = new RegExp(findStr, 'g');
            content = content.replace(regex, replaceStr);
        } catch(e) {
            alert("Invalid Regex pattern!");
            return;
        }
    } else {
        content = content.split(findStr).join(replaceStr);
    }
    
    window.cmEditor.setValue(content);
};

// FEATURE: Global Editor Search
window.openGlobalEditSearch = function() {
    if (!window.activeZipEditor) return alert("Open a book first!");
    window.closeAllModals();
    document.getElementById('editor-global-search-results').innerHTML = '';
    document.getElementById('editor-global-search-modal').classList.add('active');
};

window.runGlobalEditSearch = async function() {
    const query = document.getElementById('editor-global-search-input').value;
    const useRegex = document.getElementById('editor-global-use-regex').checked;
    const resultsContainer = document.getElementById('editor-global-search-results');
    
    if (!query) return;
    resultsContainer.innerHTML = '<div style="padding: 10px;">Searching all files...</div>';
    
    let regex;
    if (useRegex) {
        try { regex = new RegExp(query, 'gi'); } catch(e) { return alert("Invalid Regex!"); }
    }

    const htmlPaths = Object.keys(window.activeZipEditor.files).filter(p => p.match(/\.(html|xhtml|htm)$/i));
    let allResults = [];

    for (let path of htmlPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        
        let matchIndex = -1;
        if (useRegex) {
            const match = regex.exec(content);
            if(match) matchIndex = match.index;
        } else {
            matchIndex = content.toLowerCase().indexOf(query.toLowerCase());
        }

        if (matchIndex !== -1) {
            // Grab a snippet of surrounding text
            const start = Math.max(0, matchIndex - 40);
            const snippet = content.substring(start, matchIndex + query.length + 40).replace(/</g, '&lt;');
            allResults.push({ path: path, snippet: snippet });
        }
    }

    resultsContainer.innerHTML = '';
    if (allResults.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 10px;">No results found.</div>';
        return;
    }

    allResults.forEach(res => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `<div class="search-result-file">${res.path}</div><div class="search-result-text">...${res.snippet}...</div>`;
        div.onclick = () => {
            window.closeAllModals();
            // Automatically find and click the file in the sidebar tree
            const treeItems = document.querySelectorAll('.file-tree-item');
            treeItems.forEach(item => { if (item.title === res.path) item.click(); });
        };
        resultsContainer.appendChild(div);
    });
};

// FEATURE: Metadata Editor
window.openMetadataEditor = async function() {
    if (!window.activeZipEditor) return alert("Open a book first!");
    
    // Find the OPF file which holds metadata
    const opfPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
    if (!opfPath) return alert("Could not locate metadata (.opf) file in this EPUB.");

    window.currentOpfPath = opfPath;
    const opfContent = await window.activeZipEditor.file(opfPath).async("string");
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(opfContent, "application/xml");
    
    const titleNode = xmlDoc.getElementsByTagName("dc:title")[0] || xmlDoc.getElementsByTagName("title")[0];
    const authorNode = xmlDoc.getElementsByTagName("dc:creator")[0] || xmlDoc.getElementsByTagName("creator")[0];

    document.getElementById('meta-title-input').value = titleNode ? titleNode.textContent : "";
    document.getElementById('meta-author-input').value = authorNode ? authorNode.textContent : "";

    window.closeAllModals();
    document.getElementById('editor-metadata-modal').classList.add('active');
};

window.saveMetadata = async function() {
    const newTitle = document.getElementById('meta-title-input').value;
    const newAuthor = document.getElementById('meta-author-input').value;
    const btn = document.getElementById('save-meta-btn');
    
    btn.innerText = "Saving...";
    
    try {
        const opfContent = await window.activeZipEditor.file(window.currentOpfPath).async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(opfContent, "application/xml");
        
        const titleNode = xmlDoc.getElementsByTagName("dc:title")[0] || xmlDoc.getElementsByTagName("title")[0];
        const authorNode = xmlDoc.getElementsByTagName("dc:creator")[0] || xmlDoc.getElementsByTagName("creator")[0];
        
        if (titleNode) titleNode.textContent = newTitle;
        if (authorNode) authorNode.textContent = newAuthor;

        const serializer = new XMLSerializer();
        const newOpfContent = serializer.serializeToString(xmlDoc);
        
        window.activeZipEditor.file(window.currentOpfPath, newOpfContent);
        await window.saveEditedFile(); // Trigger the main compression save
        
        btn.innerText = "Saved!";
        setTimeout(() => { btn.innerText = "Save Metadata"; window.closeAllModals(); }, 1500);
        
    } catch(e) {
        console.error(e);
        btn.innerText = "Error Saving";
        setTimeout(() => btn.innerText = "Save Metadata", 1500);
    }
};

window.toggleSpellcheck = function() {
    if(!window.cmEditor) return;
    const textArea = window.cmEditor.getTextArea();
    const isSpellcheck = textArea.getAttribute("spellcheck") === "true";
    textArea.setAttribute("spellcheck", !isSpellcheck);
    alert("Native browser spellcheck: " + (!isSpellcheck ? "ON" : "OFF") + " (May require typing to trigger highlights)");
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
        // Grab the code from CodeMirror instead of textarea
        const newCode = window.cmEditor.getValue();
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
