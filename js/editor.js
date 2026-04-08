window.activeZipEditor = null;
window.activeEditingPath = null;
window.activeBookIdForEditor = null;
window.cmEditor = null; 
window.originalEpubBuffer = null; 

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
        card.innerHTML = `<img src="${coverImg}" class="book-cover"><div class="book-info"><div class="book-title" title="${value.title}">${value.title}</div><div style="font-size: 12px; color: var(--accent); margin-top: 4px;">Click to extract & edit</div></div>`;
        card.onclick = () => openEditorWorkspace(key, value.title);
        grid.appendChild(card);
    });
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
        
        refreshFileTree();
        document.getElementById('editing-file-name').innerText = "Workspace Ready: " + bookTitle;
        setTimeout(() => window.cmEditor.refresh(), 100);
    } catch (error) {
        console.error(error);
        fileListEl.innerHTML = '<div style="padding:15px; color:red;">Error extracting file.</div>';
    }
};

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
            li.onclick = () => loadFileIntoEditor(path, li);
            content.appendChild(li);
        });

        group.appendChild(header);
        group.appendChild(content);
        fileListEl.appendChild(group);
    });
};

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
        window.cmEditor.setValue("Extracting file content...");

        if (path.match(/\.(ttf|otf|woff2?)$/i)) {
            window.cmEditor.setValue("Binary font file selected. Viewing/Editing not supported.");
            return;
        }

        const textContent = await fileObj.async("string");
        window.cmEditor.setValue(textContent);
        if(path.endsWith('.css')) window.cmEditor.setOption("mode", "css");
        else if(path.endsWith('.opf') || path.endsWith('.ncx')) window.cmEditor.setOption("mode", "xml");
        else window.cmEditor.setOption("mode", "htmlmixed");
    } catch (error) {
        window.cmEditor.setValue("Error reading file content.");
    }
};

window.editorReplaceSingle = function() {
    if (!window.cmEditor) return;
    const findStr = document.getElementById('editor-find').value;
    const replaceStr = document.getElementById('editor-replace').value;
    const useRegex = document.getElementById('editor-use-regex').checked;
    if(!findStr) return;

    let query = useRegex ? new RegExp(findStr) : findStr;
    let cursor = window.cmEditor.getSearchCursor(query, window.cmEditor.getCursor());
    
    if (cursor.findNext()) {
        cursor.replace(replaceStr);
        window.cmEditor.setSelection(cursor.from(), cursor.to());
    } else {
        cursor = window.cmEditor.getSearchCursor(query);
        if (cursor.findNext()) {
            cursor.replace(replaceStr);
            window.cmEditor.setSelection(cursor.from(), cursor.to());
        }
    }
};

window.editorReplaceAll = function() {
    if (!window.cmEditor) return;
    const findStr = document.getElementById('editor-find').value;
    const replaceStr = document.getElementById('editor-replace').value;
    const useRegex = document.getElementById('editor-use-regex').checked;
    if(!findStr) return;
    
    let content = window.cmEditor.getValue();
    if (useRegex) {
        try { content = content.replace(new RegExp(findStr, 'g'), replaceStr); } 
        catch(e) { return alert("Invalid Regex pattern!"); }
    } else {
        content = content.split(findStr).join(replaceStr);
    }
    window.cmEditor.setValue(content);
};

window.openGlobalEditSearch = function() {
    if (!window.activeZipEditor) return;
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
    if (useRegex) { try { regex = new RegExp(query, 'gi'); } catch(e) { return alert("Invalid Regex!"); } }

    const htmlPaths = Object.keys(window.activeZipEditor.files).filter(p => p.match(/\.(html|xhtml|htm)$/i));
    let allResults = [];

    for (let path of htmlPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        let matchIndex = useRegex ? (regex.exec(content) || {}).index : content.toLowerCase().indexOf(query.toLowerCase());
        if (matchIndex !== undefined && matchIndex !== -1) {
            const start = Math.max(0, matchIndex - 40);
            const snippet = content.substring(start, matchIndex + query.length + 40).replace(/</g, '&lt;');
            allResults.push({ path, snippet });
        }
    }

    resultsContainer.innerHTML = '';
    if (allResults.length === 0) return resultsContainer.innerHTML = '<div style="padding: 10px;">No results found.</div>';
    
    allResults.forEach(res => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `<div class="search-result-file">${res.path}</div><div class="search-result-text">...${res.snippet}...</div>`;
        div.onclick = () => {
            window.closeAllModals();
            document.querySelectorAll('.file-tree-item').forEach(item => { if (item.title === res.path) item.click(); });
            document.getElementById('editor-find').value = query;
            document.getElementById('editor-use-regex').checked = useRegex;
        };
        resultsContainer.appendChild(div);
    });
};

window.openMetadataEditor = async function() {
    if (!window.activeZipEditor) return;
    const opfPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
    if (!opfPath) return alert("Could not locate .opf metadata file.");
    window.currentOpfPath = opfPath;
    const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(opfPath).async("string"), "application/xml");
    const titleNode = xmlDoc.getElementsByTagName("dc:title")[0] || xmlDoc.getElementsByTagName("title")[0];
    const authorNode = xmlDoc.getElementsByTagName("dc:creator")[0] || xmlDoc.getElementsByTagName("creator")[0];

    document.getElementById('meta-title-input').value = titleNode ? titleNode.textContent : "";
    document.getElementById('meta-author-input').value = authorNode ? authorNode.textContent : "";
    window.closeAllModals();
    document.getElementById('editor-metadata-modal').classList.add('active');
};

window.saveMetadata = async function() {
    const btn = document.getElementById('save-meta-btn'); btn.innerText = "Saving...";
    try {
        const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(window.currentOpfPath).async("string"), "application/xml");
        const tNode = xmlDoc.getElementsByTagName("dc:title")[0];
        const aNode = xmlDoc.getElementsByTagName("dc:creator")[0];
        if (tNode) tNode.textContent = document.getElementById('meta-title-input').value;
        if (aNode) aNode.textContent = document.getElementById('meta-author-input').value;
        
        window.activeZipEditor.file(window.currentOpfPath, new XMLSerializer().serializeToString(xmlDoc));
        await window.saveEditedFile();
        btn.innerText = "Saved!";
        setTimeout(() => { btn.innerText = "Save Metadata"; window.closeAllModals(); }, 1000);
    } catch(e) { btn.innerText = "Error"; setTimeout(() => btn.innerText = "Save", 1500); }
};

window.openTocEditor = async function() {
    if (!window.activeZipEditor) return;
    const ncxPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.ncx'));
    if (!ncxPath) return alert("Advanced TOC editing requires an NCX file.");
    
    window.currentNcxPath = ncxPath;
    const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(ncxPath).async("string"), "application/xml");
    const navPoints = xmlDoc.getElementsByTagName("navPoint");
    
    const listEl = document.getElementById('toc-edit-list');
    listEl.innerHTML = '';
    
    Array.from(navPoints).forEach((node, i) => {
        const textNode = node.getElementsByTagName("text")[0];
        const label = textNode ? textNode.textContent : "Chapter";
        const div = document.createElement('div');
        div.className = 'toc-edit-row';
        div.innerHTML = `<i class="ph ph-list"></i><input type="text" data-index="${i}" value="${label.replace(/"/g, '&quot;')}">`;
        listEl.appendChild(div);
    });

    window.closeAllModals();
    document.getElementById('editor-toc-modal').classList.add('active');
};

window.generateTocFromHeadings = async function() {
    if (!confirm("This will scan all HTML files and rebuild the TOC list based on the first <h1> or <h2> tag found. Continue?")) return;
    
    const htmlPaths = Object.keys(window.activeZipEditor.files).filter(p => p.match(/\.(html|xhtml|htm)$/i));
    const listEl = document.getElementById('toc-edit-list');
    listEl.innerHTML = '<div style="padding:10px;">Scanning files...</div>';
    
    let generatedList = [];
    
    for (let path of htmlPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        const match = content.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
        if (match && match[1]) {
            const cleanTitle = match[1].replace(/<[^>]*>?/gm, '').trim();
            if(cleanTitle) generatedList.push(cleanTitle);
        } else {
            generatedList.push("Chapter (No Heading Found)");
        }
    }
    
    listEl.innerHTML = '';
    generatedList.forEach((label, i) => {
        const div = document.createElement('div');
        div.className = 'toc-edit-row';
        div.innerHTML = `<i class="ph ph-list"></i><input type="text" data-index="${i}" value="${label.replace(/"/g, '&quot;')}">`;
        listEl.appendChild(div);
    });
};

window.saveTocEdits = async function() {
    const btn = document.getElementById('save-toc-btn'); btn.innerText = "Saving...";
    try {
        const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(window.currentNcxPath).async("string"), "application/xml");
        const navPoints = xmlDoc.getElementsByTagName("navPoint");
        
        document.querySelectorAll('.toc-edit-row input').forEach(input => {
            const idx = input.getAttribute('data-index');
            const textNode = navPoints[idx].getElementsByTagName("text")[0];
            if (textNode) textNode.textContent = input.value;
        });

        window.activeZipEditor.file(window.currentNcxPath, new XMLSerializer().serializeToString(xmlDoc));
        await window.saveEditedFile();
        btn.innerText = "Saved!";
        setTimeout(() => { btn.innerText = "Save TOC XML"; window.closeAllModals(); }, 1000);
    } catch(e) { btn.innerText = "Error"; }
};

window.openAddFileModal = function() {
    if (!window.activeZipEditor) return;
    document.getElementById('add-outside-file-input').value = "";
    window.closeAllModals();
    document.getElementById('editor-add-file-modal').classList.add('active');
};

window.confirmAddOutsideFile = async function() {
    const fileInput = document.getElementById('add-outside-file-input');
    if (fileInput.files.length === 0) return alert("Please select a file.");
    
    const file = fileInput.files[0];
    const opfPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
    const baseFolder = opfPath ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    
    let targetFolder = baseFolder;
    let mediaType = "application/octet-stream";
    
    if (file.type.includes('image')) { targetFolder += 'Images/'; mediaType = file.type; }
    else if (file.type.includes('css')) { targetFolder += 'Styles/'; mediaType = "text/css"; }
    else if (file.type.includes('html')) { targetFolder += 'Text/'; mediaType = "application/xhtml+xml"; }
    
    const targetPath = targetFolder + file.name;
    const arrayBuffer = await file.arrayBuffer();
    
    window.activeZipEditor.file(targetPath, arrayBuffer);
    
    if (opfPath) {
        const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(opfPath).async("string"), "application/xml");
        const manifest = xmlDoc.getElementsByTagName("manifest")[0];
        if (manifest) {
            const id = "file_" + Date.now();
            const item = xmlDoc.createElement("item");
            item.setAttribute("id", id);
            const relativeHref = targetPath.replace(baseFolder, '');
            item.setAttribute("href", relativeHref);
            item.setAttribute("media-type", mediaType);
            manifest.appendChild(item);
            window.activeZipEditor.file(opfPath, new XMLSerializer().serializeToString(xmlDoc));
        }
    }
    
    await window.saveEditedFile();
    refreshFileTree();
    window.closeAllModals();
    alert("File imported and registered in Manifest successfully!");
};

// --- UPDATED: TYPO & SPELLCHECK SCANNER (New UI & CJK Sorting) ---
window.openSpellcheckModal = async function() {
    if (!window.activeZipEditor) return;
    
    const listEl = document.getElementById('spellcheck-list');
    listEl.innerHTML = '<div style="padding:30px; text-align:center;"><i class="ph ph-spinner ph-spin" style="font-size:32px; color:var(--accent);"></i><p style="margin-top:10px; color:var(--text-muted);">Scanning entire book for uncommon words...</p></div>';
    
    window.closeAllModals();
    document.getElementById('editor-spellcheck-modal').classList.add('active');

    const htmlPaths = Object.keys(window.activeZipEditor.files).filter(p => p.match(/\.(html|xhtml|htm)$/i));
    let wordMap = {};

    for (let path of htmlPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        const textOnly = content.replace(/<[^>]*>?/gm, ' ');
        
        // Matches English, Hangul, Kana, and Hanzi
        const words = textOnly.match(/[\w\uAC00-\uD7A3\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g) || [];
        
        words.forEach(w => {
            if (w.length < 2 && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(w)) return; 
            wordMap[w] = (wordMap[w] || 0) + 1;
        });
    }

    let suspiciousWords = Object.keys(wordMap).filter(w => {
        if (wordMap[w] === 1) return true;
        if (/\d/.test(w) && /[a-zA-Z]/.test(w)) return true; 
        return false;
    });

    suspiciousWords.sort((a, b) => a.localeCompare(b));

    listEl.innerHTML = '';
    if (suspiciousWords.length === 0) {
        listEl.innerHTML = '<div style="padding:30px; text-align:center; color:var(--success);"><i class="ph ph-check-circle" style="font-size:48px;"></i><p style="margin-top:10px; font-weight:600;">No rare words or obvious OCR typos found!</p></div>';
        return;
    }

    const header = document.createElement('div');
    header.className = 'spellcheck-header';
    header.innerHTML = `<span>Potential Typo / Word</span><span>Occurrences</span>`;
    listEl.appendChild(header);

    suspiciousWords.slice(0, 150).forEach(word => {
        const div = document.createElement('div');
        div.className = 'spellcheck-item';
        div.innerHTML = `<span class="spellcheck-word">${word}</span> <span class="spellcheck-count">${wordMap[word]} <i class="ph ph-magnifying-glass"></i></span>`;
        
        div.onclick = () => {
            document.getElementById('editor-global-search-input').value = word;
            document.getElementById('editor-global-use-regex').checked = false;
            runGlobalEditSearch();
            document.getElementById('editor-global-search-modal').classList.add('active');
        };
        listEl.appendChild(div);
    });
};

window.runEpubDebugger = async function() {
    if (!window.activeZipEditor) return;
    const consoleEl = document.getElementById('debug-console');
    consoleEl.innerHTML = '<div class="debug-log-item">Starting OPF Manifest Scan...</div>';
    window.closeAllModals();
    document.getElementById('editor-debug-modal').classList.add('active');

    const opfPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
    if (!opfPath) return consoleEl.innerHTML += '<div class="debug-log-item error">[FAIL] No .opf manifest found.</div>';
    
    const opfFolder = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(opfPath).async("string"), "application/xml");
    const items = xmlDoc.getElementsByTagName("item");
    
    let errors = 0;
    Array.from(items).forEach(item => {
        const href = item.getAttribute("href");
        if (!href) return;
        const fullPath = decodeURIComponent(opfFolder + href);
        if (!window.activeZipEditor.file(fullPath) && !window.activeZipEditor.folder(fullPath)) {
            consoleEl.innerHTML += `<div class="debug-log-item error">[BROKEN LINK] Manifest expects: ${fullPath}</div>`;
            errors++;
        }
    });
    
    if (errors === 0) consoleEl.innerHTML += '<div class="debug-log-item success">[PASS] All manifest links are valid!</div>';
    else consoleEl.innerHTML += `<div class="debug-log-item">[WARNING] Found ${errors} missing files.</div>`;
};

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

window.closeEditorWorkspace = function() {
    window.activeZipEditor = null;
    window.activeEditingPath = null;
    window.activeBookIdForEditor = null;
    window.originalEpubBuffer = null;
    document.getElementById('editor-setup').style.display = 'block';
    document.getElementById('editor-workspace').style.display = 'none';
    document.getElementById('editor-main-toolbar').style.display = 'none';
};
