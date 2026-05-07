/**
 * Editor XML Tools Module
 * Manages XML/structural operations: opening and saving metadata,
 * managing the TOC editor, and generating the TOC from headings.
 */

/**
 * Opens the metadata editor modal
 * Loads OPF file and populates title/author fields
 * @returns {Promise<void>}
 */
window.openMetadataEditor = async function() {
    if (!window.activeZipEditor) return;
    const opfPath = window.findOpfPath();
    if (!opfPath) return alert("Could not locate .opf metadata file.");
    window.currentOpfPath = opfPath;
    
    const xmlDoc = await window.parseXmlFile(opfPath);
    const titleNode = xmlDoc.getElementsByTagName("dc:title")[0] || xmlDoc.getElementsByTagName("title")[0];
    const authorNode = xmlDoc.getElementsByTagName("dc:creator")[0] || xmlDoc.getElementsByTagName("creator")[0];

    document.getElementById('meta-title-input').value = titleNode ? titleNode.textContent : "";
    document.getElementById('meta-author-input').value = authorNode ? authorNode.textContent : "";
    
    window.openEditorModal('editor-metadata-modal');
};

/**
 * Saves metadata changes to the OPF file in EPUB
 * Updates title and author, then saves the EPUB
 * @returns {Promise<void>}
 */
window.saveMetadata = async function() {
    const btn = document.getElementById('save-meta-btn'); btn.innerText = "Saving...";
    try {
        const xmlDoc = await window.parseXmlFile(window.currentOpfPath);
        const tNode = xmlDoc.getElementsByTagName("dc:title")[0];
        const aNode = xmlDoc.getElementsByTagName("dc:creator")[0];
        if (tNode) tNode.textContent = document.getElementById('meta-title-input').value;
        if (aNode) aNode.textContent = document.getElementById('meta-author-input').value;
        
        window.serializeAndSaveXml(window.currentOpfPath, xmlDoc);
        await window.saveEditedFile();
        btn.innerText = "Saved!";
        setTimeout(() => {
            btn.innerText = "Save Metadata";
            window.closeEditorModal('editor-metadata-modal');
        }, 1000);
    } catch(e) { btn.innerText = "Error"; setTimeout(() => btn.innerText = "Save Metadata", 1500); }
};

/**
 * Opens the TOC (Table of Contents) editor modal
 * Loads NCX file and displays navPoints for editing
 * @returns {Promise<void>}
 */
window.openTocEditor = async function() {
    if (!window.activeZipEditor) return;
    const ncxPath = window.findNcxPath();
    if (!ncxPath) return alert("Advanced TOC editing requires an NCX file.");
    
    window.currentNcxPath = ncxPath;
    const xmlDoc = await window.parseXmlFile(ncxPath);
    const navPoints = xmlDoc.getElementsByTagName("navPoint");
    
    const listEl = document.getElementById('toc-edit-list');
    listEl.innerHTML = '';
    
    Array.from(navPoints).forEach((node, i) => {
        const textNode = node.getElementsByTagName("text")[0];
        const label = textNode ? textNode.textContent : "Chapter";
        const div = document.createElement('div');
        div.className = 'toc-edit-row';
        div.innerHTML = `<i class="ph ph-list"></i><input type="text" data-index="${i}" value="${label.replace(/"/g, '"')}">`;
        listEl.appendChild(div);
    });
    
    window.openEditorModal('editor-toc-modal');
};

/**
 * Generates TOC from HTML headings (h1, h2) in all HTML files
 * Scans files and creates TOC entries based on heading text
 * @returns {Promise<void>}
 */
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
            if (cleanTitle) generatedList.push(cleanTitle);
        } else {
            generatedList.push("Chapter (No Heading Found)");
        }
    }
    
    listEl.innerHTML = '';
    generatedList.forEach((label, i) => {
        const div = document.createElement('div');
        div.className = 'toc-edit-row';
        div.innerHTML = `<i class="ph ph-list"></i><input type="text" data-index="${i}" value="${label.replace(/"/g, '"')}">`;
        listEl.appendChild(div);
    });
};

/**
 * Saves TOC edits to the NCX file in EPUB
 * Updates navPoint text entries based on user input
 * @returns {Promise<void>}
 */
window.saveTocEdits = async function() {
    const btn = document.getElementById('save-toc-btn'); btn.innerText = "Saving...";
    try {
        const xmlDoc = await window.parseXmlFile(window.currentNcxPath);
        const navPoints = xmlDoc.getElementsByTagName("navPoint");
        
        document.querySelectorAll('.toc-edit-row input').forEach(input => {
            const idx = input.getAttribute('data-index');
            const textNode = navPoints[idx].getElementsByTagName("text")[0];
            if (textNode) textNode.textContent = input.value;
        });

        window.serializeAndSaveXml(window.currentNcxPath, xmlDoc);
        await window.saveEditedFile();
        btn.innerText = "Saved!";
        setTimeout(() => {
            btn.innerText = "Save TOC XML";
            window.closeEditorModal('editor-toc-modal');
        }, 1000);
    } catch(e) { btn.innerText = "Error"; }
};
