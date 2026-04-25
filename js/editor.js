window.activeZipEditor = null;
window.activeEditingPath = null;
window.activeBookIdForEditor = null;
window.cmEditor = null; 
window.originalEpubBuffer = null; 

const originalShowView = window.showView;
window.showView = function(viewId) {
    // 1. Update the UI and active screens
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(viewId + '-view');
    if(targetView) targetView.classList.add('active');
    
    history.pushState({ view: viewId }, '', '#' + viewId);
    let title = "Library";
    if (viewId === 'bookmarks') title = "Bookmarks";
    if (viewId === 'editor') title = "Edit Book";
    document.getElementById('page-title').innerText = title;

    // 2. FIXED: Actually tell the app to load the data when you switch tabs!
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

let currentEditorPage = 1;

// --- RAM-SAFE PAGINATED EDITOR LOADING ---
window.loadEditorBookList = async function(page = 1) {
    const grid = document.getElementById('editor-book-list');
    const paginationContainer = document.getElementById('editor-pagination');
    if (!grid) return;
    
    currentEditorPage = page;
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 32px; color: var(--accent);"></i><p style="color: var(--text-muted); margin-top: 10px;">Loading editor library...</p></div>';
    
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

    if (window.librarySortOrder === 'az') catalog.sort((a, b) => a.title.localeCompare(b.title));
    else if (window.librarySortOrder === 'za') catalog.sort((a, b) => b.title.localeCompare(a.title));

    const BOOKS_PER_PAGE = 100;
    const totalPages = Math.ceil(catalog.length / BOOKS_PER_PAGE) || 1;
    if (currentEditorPage > totalPages) currentEditorPage = totalPages;

    const startIndex = (currentEditorPage - 1) * BOOKS_PER_PAGE;
    const pageItems = catalog.slice(startIndex, startIndex + BOOKS_PER_PAGE);

    const cards = [];
    
    for (let item of pageItems) {
        const value = await localforage.getItem(item.key);
        if (!value) continue;

        const coverImg = value.cover ? value.cover : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `<img src="${coverImg}" class="book-cover"><div class="book-info"><div class="book-title" title="${value.title}">${value.title}</div><div style="font-size: 12px; color: var(--accent); margin-top: 4px;">Click to extract & edit</div></div>`;
        card.onclick = () => openEditorWorkspace(item.key, value.title);
        cards.push(card);
    }
    
    grid.innerHTML = '';
    cards.forEach(card => grid.appendChild(card));
    
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = `page-btn ${i === currentEditorPage ? 'active' : ''}`;
                btn.innerText = i;
                btn.onclick = () => window.loadEditorBookList(i);
                paginationContainer.appendChild(btn);
            }
        }
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
        refreshFileTree();
        document.getElementById('editing-file-name').innerText = "Workspace Ready: " + bookTitle;
        setTimeout(() => window.cmEditor.refresh(), 100);
    } catch (error) {
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
        setTimeout(() => window.cmEditor.refresh(), 10);
        window.cmEditor.setValue("Extracting file content...");

        if (path.match(/\.(ttf|otf|woff2?)$/i)) return window.cmEditor.setValue("Binary font file selected. Viewing/Editing not supported.");

        const textContent = await fileObj.async("string");
        window.cmEditor.setValue(textContent);
        if(path.endsWith('.css')) window.cmEditor.setOption("mode", "css");
        else if(path.endsWith('.opf') || path.endsWith('.ncx')) window.cmEditor.setOption("mode", "xml");
        else window.cmEditor.setOption("mode", "htmlmixed");
    } catch (error) { window.cmEditor.setValue("Error reading file content."); }
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
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
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
            if(window.closeAllModals) window.closeAllModals();
            else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            
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
    
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
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
        setTimeout(() => { 
            btn.innerText = "Save Metadata"; 
            if(window.closeAllModals) window.closeAllModals();
            else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        }, 1000);
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

    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
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
        setTimeout(() => { 
            btn.innerText = "Save TOC XML"; 
            if(window.closeAllModals) window.closeAllModals();
            else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        }, 1000);
    } catch(e) { btn.innerText = "Error"; }
};

window.openAddFileModal = function() {
    if (!window.activeZipEditor) return;
    document.getElementById('add-outside-file-input').value = "";
    document.getElementById('selected-files-list').innerHTML = ""; 
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('editor-add-file-modal').classList.add('active');
};

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
    refreshFileTree();
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    alert(`Successfully imported and registered ${fileInput.files.length} file(s)!`);
};

window.openSpellcheckModal = async function() {
    if (!window.activeZipEditor) return;
    
    const listEl = document.getElementById('spellcheck-list');
    listEl.innerHTML = '<div style="padding:30px; text-align:center;"><i class="ph ph-spinner ph-spin" style="font-size:32px; color:var(--accent);"></i><p style="margin-top:10px; color:var(--text-muted);">Scanning entire book for uncommon words...</p></div>';
    
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('editor-spellcheck-modal').classList.add('active');

    const htmlPaths = Object.keys(window.activeZipEditor.files).filter(p => p.match(/\.(html|xhtml|htm)$/i));
    let wordMap = {};

    for (let path of htmlPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        const textOnly = content.replace(/<[^>]*>?/gm, ' ');
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

window.openCleanerModal = function() {
    if (!window.activeZipEditor) return;
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('cleaner-console').innerHTML = 'Ready to scan. Select options above and click Run.';
    document.getElementById('editor-cleaner-modal').classList.add('active');
};

window.runEpubCleaner = async function() {
    const btn = document.getElementById('run-cleaner-btn');
    const consoleEl = document.getElementById('cleaner-console');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...';
    btn.disabled = true;
    consoleEl.innerHTML = ''; 

    const logMsg = (html) => consoleEl.insertAdjacentHTML('beforeend', html);

    const doHiddenP = document.getElementById('clean-hidden-p').checked;
    const doInlineImg = document.getElementById('clean-inline-img').checked;
    const doOrphans = document.getElementById('clean-orphans').checked;
    const doNestedP = document.getElementById('clean-nested-p').checked; 
    const doTags = document.getElementById('clean-detect-tags').checked;

    const htmlPaths = Object.keys(window.activeZipEditor.files).filter(p => p.match(/\.(html|xhtml|htm|xml)$/i));
    let scanned = 0;
    let modifiedFiles = 0;
    let removedTotal = 0;
    let unclosedTotal = 0;

    for (let path of htmlPaths) {
        let originalText = await window.activeZipEditor.file(path).async("string");
        let cleanedText = originalText;
        let removedItems = [];
        let unclosedTags = [];
        scanned++;

        if (doHiddenP) {
            const re = /<p\s+style=['"](?:[^'"]*)height:\s*0px;[^>]*>[\s\S]*?<\/p>/gi;
            const matches = cleanedText.match(re);
            if (matches) removedItems.push(...matches);
            cleanedText = cleanedText.replace(re, "");
        }
        
        if (doInlineImg) {
            const re = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi;
            const matches = cleanedText.match(re);
            if (matches) removedItems.push(...matches);
            cleanedText = cleanedText.replace(re, "");
        }

        if (doOrphans) {
            const re = /[A-Za-z0-9+/=]{40,}/g; 
            const matches = cleanedText.match(re);
            if (matches) removedItems.push(...matches);
            cleanedText = cleanedText.replace(re, "");
        }

        if (doNestedP) {
            let passes = 0;
            let previous = "";
            while (cleanedText !== previous && passes < 5) {
                previous = cleanedText;
                const openRe = /(<p\b[^>]*>)\s*(?:<p\b[^>]*>\s*)+/gi;
                const openMatches = cleanedText.match(openRe);
                if (openMatches) {
                    removedItems.push(...openMatches.map(() => "Overwrapped <p> start tag"));
                    cleanedText = cleanedText.replace(openRe, "$1");
                }
                const closeRe = /(<\/p>)\s*(?:<\/p>\s*)+/gi;
                const closeMatches = cleanedText.match(closeRe);
                if (closeMatches) {
                    removedItems.push(...closeMatches.map(() => "Overwrapped </p> end tag"));
                    cleanedText = cleanedText.replace(closeRe, "$1");
                }
                passes++;
            }
        }

        if (doTags) {
            const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
            const tagRegex = /<\/?([a-z0-9:]+)[^>]*>/gi;
            let match;
            const stack = [];
            
            const getLineCol = (index) => {
                const upTo = cleanedText.substring(0, index);
                const lines = upTo.split('\n');
                return { line: lines.length, col: lines[lines.length - 1].length + 1 };
            };

            while ((match = tagRegex.exec(cleanedText)) !== null) {
                const isClosing = match[0].startsWith('</');
                const tagName = match[1].toLowerCase();
                const isSelfClosing = match[0].endsWith('/>') || voidElements.has(tagName);

                if (isClosing) {
                    if (stack.length > 0 && stack[stack.length - 1].tag === tagName) stack.pop();
                } else if (!isSelfClosing) {
                    stack.push({ tag: tagName, pos: getLineCol(match.index) });
                }
            }

            for (const item of stack) {
                if(item.tag === 'html' || item.tag === 'body' || item.tag === '?xml') continue; 
                unclosedTags.push(`&lt;${item.tag}&gt; opened at Line ${item.pos.line}, Col ${item.pos.col} but never closed.`);
            }
        }

        if (cleanedText !== originalText) {
            window.activeZipEditor.file(path, cleanedText);
            modifiedFiles++;
            removedTotal += removedItems.length;
        }

        if (unclosedTags.length > 0) unclosedTotal += unclosedTags.length;

        if (removedItems.length > 0 || unclosedTags.length > 0) {
            logMsg(`<div class="debug-log-item"><strong style="color:var(--accent);">== ${path} ==</strong></div>`);
            if (removedItems.length > 0) logMsg(`<div class="debug-log-item" style="color:var(--success);">Removed ${removedItems.length} bloat items.</div>`);
            if (unclosedTags.length > 0) logMsg(`<div class="debug-log-item error">Found ${unclosedTags.length} unclosed tags:<br>${unclosedTags.join('<br>')}</div>`);
        }
    }

    if (removedTotal === 0 && unclosedTotal === 0) {
        logMsg(`<div class="debug-log-item success">Scan complete. No hidden paragraphs, blobs, or unclosed tags found in ${scanned} files.</div>`);
    } else {
        logMsg(`<div class="debug-log-item" style="border-top:2px solid var(--border); margin-top:10px;"><strong style="color:var(--accent);">SUMMARY:</strong> Scanned ${scanned} files. Removed ${removedTotal} blobs. Found ${unclosedTotal} unclosed tags. <br><br><strong>Please click 'Save File' in the editor to permanently write these changes!</strong></div>`);
        if (window.activeEditingPath && window.activeZipEditor.file(window.activeEditingPath)) {
            const newText = await window.activeZipEditor.file(window.activeEditingPath).async("string");
            window.cmEditor.setValue(newText);
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
};

window.runEpubDebugger = async function() {
    if (!window.activeZipEditor) return;
    const consoleEl = document.getElementById('debug-console');
    
    consoleEl.innerHTML = '<div class="debug-log-item">Starting Comprehensive Diagnostics...</div>';
    const logMsg = (html) => consoleEl.insertAdjacentHTML('beforeend', html);

    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('editor-debug-modal').classList.add('active');

    let errorsFound = 0;
    let warningsFound = 0;

const appendJumpableError = (path, errorText, lineNum, isWarning = false) => {
        const div = document.createElement('div');
        div.className = 'debug-log-item error';
        div.style.cursor = 'pointer';
        div.style.borderLeft = `3px solid ${isWarning ? 'orange' : 'var(--danger)'}`;
        div.style.transition = 'background 0.2s';
        div.onmouseover = () => div.style.background = 'var(--surface)';
        div.onmouseout = () => div.style.background = 'transparent';
        
        const icon = isWarning ? '<i class="ph ph-warning" style="color:orange;"></i>' : '<i class="ph ph-warning-octagon" style="color:var(--danger);"></i>';
        const titleColor = isWarning ? 'orange' : 'var(--danger)';
        const titleText = isWarning ? '[WARNING]' : '[PARSE ERROR]';

        div.innerHTML = `<div style="font-weight:bold; color:${titleColor};">${icon} ${titleText} ${path}</div>
                         <div style="color:var(--text-muted); font-family:monospace; margin:4px 0;">${errorText}</div>
                         <div style="font-size:10px; color:var(--accent);"><i class="ph ph-mouse-pointer-click"></i> Click to fix in editor</div>`;
        
        div.onclick = async () => {
            console.log("👉 1. ERROR CLICKED!");
            console.log("👉 Target Path:", path);
            console.log("👉 Target Line:", lineNum);

            try {
                if(window.closeAllModals) window.closeAllModals();
                else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
                console.log("👉 2. Modal closed.");
                
                let targetLi = null;
                document.querySelectorAll('.file-tree-item').forEach(item => {
                    if (item.title === path) targetLi = item;
                });
                console.log("👉 3. Found sidebar item:", targetLi);
                
                if (targetLi) {
                    let folderContent = targetLi.closest('.folder-content');
                    if (folderContent && !folderContent.classList.contains('open')) {
                        folderContent.classList.add('open');
                        let header = folderContent.previousElementSibling;
                        if (header) header.classList.add('open');
                    }
                }
                
                console.log("👉 4. Loading file into editor...");
                await window.loadFileIntoEditor(path, targetLi);
                console.log("👉 5. File loaded successfully.");
                
                if (lineNum >= 0) {
                    setTimeout(() => {
                        console.log("👉 6. Timeout started (300ms). Checking cmEditor:", !!window.cmEditor);
                        if (!window.cmEditor) return;
                        
                        window.cmEditor.refresh(); 
                        const safeLine = Math.max(0, Math.min(lineNum, window.cmEditor.lineCount() - 1));
                        console.log("👉 7. Safe line calculated:", safeLine);
                        
                        window.cmEditor.focus();
                        window.cmEditor.setCursor({line: safeLine, ch: 0});
                        console.log("👉 8. Cursor set.");
                        
                        try {
                            const t = window.cmEditor.charCoords({line: safeLine, ch: 0}, "local").top; 
                            const h = window.cmEditor.getScrollerElement().offsetHeight / 2; 
                            console.log(`👉 9. Scrolling to Top: ${t}, Half-Height: ${h}`);
                            window.cmEditor.scrollTo(null, t - h - 5);
                        } catch(e) {
                            console.error("👉 Scroll Math Error:", e);
                        }
                        
                        window.cmEditor.addLineClass(safeLine, 'background', 'error-line-highlight');
                        setTimeout(() => window.cmEditor.removeLineClass(safeLine, 'background', 'error-line-highlight'), 4000);
                        console.log("👉 10. JUMP COMPLETE.");
                    }, 300); 
                }
            } catch (err) {
                console.error("👉 CRITICAL ERROR IN CLICK HANDLER:", err);
            }
        };
        consoleEl.appendChild(div);
        if (isWarning) warningsFound++; else errorsFound++;
    };

    const opfPath = Object.keys(window.activeZipEditor.files).find(p => p.endsWith('.opf'));
    if (!opfPath) {
        logMsg('<div class="debug-log-item error">[FAIL] No .opf manifest found.</div>');
        return;
    }

    const opfFolder = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const xmlDoc = new DOMParser().parseFromString(await window.activeZipEditor.file(opfPath).async("string"), "application/xml");
    const items = xmlDoc.getElementsByTagName("item");
    const manifestPaths = new Set();

    logMsg('<div class="debug-log-item" style="color:var(--accent);">[1/4] Scanning OPF Manifest & Broken Links...</div>');
    Array.from(items).forEach(item => {
        const href = item.getAttribute("href");
        if (!href) return;
        const fullPath = decodeURIComponent(opfFolder + href);
        manifestPaths.add(fullPath);
        if (!window.activeZipEditor.file(fullPath) && !window.activeZipEditor.folder(fullPath)) {
            logMsg(`<div class="debug-log-item error" style="border-left: 3px solid var(--danger);"><i class="ph ph-link-break"></i> [MISSING FILE] Manifest expects: ${fullPath}</div>`);
            errorsFound++;
        }
    });

    logMsg('<div class="debug-log-item" style="color:var(--accent); margin-top:10px;">[2/4] Checking for Unreferenced Files...</div>');
    const allZipFiles = Object.keys(window.activeZipEditor.files).filter(p => !window.activeZipEditor.files[p].dir);
    allZipFiles.forEach(path => {
        if (path === 'mimetype' || path.startsWith('META-INF/') || path.endsWith('.opf') || path.endsWith('.ncx')) return;
        if (!manifestPaths.has(path)) {
            logMsg(`<div class="debug-log-item" style="border-left: 3px solid orange; color: orange;"><i class="ph ph-warning"></i> [UNREFERENCED FILE] ${path} is not in the OPF manifest. It may not display in readers.</div>`);
            warningsFound++;
        }
    });

    logMsg('<div class="debug-log-item" style="color:var(--accent); margin-top:10px;">[3/4] Validating HTML Integrity & Links...</div>');
    const htmlPaths = allZipFiles.filter(p => p.match(/\.(html|xhtml|htm)$/i));
    
    const resolvePath = (basePath, relativePath) => {
        const stack = basePath.split('/').slice(0, -1);
        for (const p of relativePath.split('/')) {
            if (p === '..') stack.pop(); else if (p !== '.') stack.push(p);
        }
        return stack.join('/');
    };

    for (let path of htmlPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        
        const parser = new DOMParser();
        const parseErrors = parser.parseFromString(content, "application/xml").getElementsByTagName("parsererror");
        
        if (parseErrors.length > 0) {
            let errorText = parseErrors[0].textContent.replace(/This page contains the following errors:/gi, '').replace(/Below is a rendering of the page up to the first error./gi, '').trim();
            let lineNum = 0;
            const lineMatch = errorText.match(/line\s+(\d+)/i);
            if (lineMatch) lineNum = parseInt(lineMatch[1]) - 1;
            appendJumpableError(path, errorText, lineNum, false);
        }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let match;
            const linkRe = /(?:href|src)=['"]([^'"]+)['"]/gi;
            while ((match = linkRe.exec(lines[i])) !== null) {
                let link = match[1].split('#')[0]; 
                if (!link || link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('data:')) continue;
                
                const fullLink = resolvePath(path, link);
                if (!window.activeZipEditor.file(fullLink)) {
                    appendJumpableError(path, `Broken internal link to: ${link}`, i, true);
                }
            }
        }
    }

    logMsg('<div class="debug-log-item" style="color:var(--accent); margin-top:10px;">[4/4] Checking CSS Stylesheets...</div>');
    const cssPaths = allZipFiles.filter(p => p.endsWith('.css'));
    for (let path of cssPaths) {
        const content = await window.activeZipEditor.file(path).async("string");
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/font-family\s*:\s*([^;{}]+)\s*;/i);
            if (match && !match[1].match(/(serif|sans-serif|monospace|cursive|fantasy)/i)) {
                appendJumpableError(path, `CSS Warning: "${match[1].trim()}" lacks a generic fallback (e.g. serif).`, i, true);
            }
        }
    }

    if (errorsFound === 0 && warningsFound === 0) {
        logMsg('<div class="debug-log-item success" style="margin-top:10px; font-weight:bold;"><i class="ph ph-check-circle"></i> [PASS] 0 errors or warnings found! EPUB is perfectly formed.</div>');
    } else {
        logMsg(`<div class="debug-log-item" style="margin-top:10px; border-top: 1px solid var(--border); padding-top: 10px;"><strong>[SUMMARY] Found ${errorsFound} errors and ${warningsFound} warnings.</strong> Click any error above to jump directly to the code.</div>`);
    }
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
