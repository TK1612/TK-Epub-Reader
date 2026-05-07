/**
 * Editor Search & Replace Module
 * Isolates the logic for opening the global edit search,
 * running searches, and executing single or global find-and-replace actions.
 */

/**
 * Replaces the next occurrence of find string with replace string in CodeMirror
 * Uses CodeMirror's built-in search cursor for accurate replacement
 * @returns {void}
 */
window.editorReplaceSingle = function() {
    if (!window.cmEditor) return;
    const findStr = document.getElementById('editor-find').value;
    const replaceStr = document.getElementById('editor-replace').value;
    const useRegex = document.getElementById('editor-use-regex').checked;
    if (!findStr) return;

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

/**
 * Replaces all occurrences of find string with replace string in CodeMirror
 * Uses string replace for global replacement (supports regex)
 * @returns {void}
 */
window.editorReplaceAll = function() {
    if (!window.cmEditor) return;
    const findStr = document.getElementById('editor-find').value;
    const replaceStr = document.getElementById('editor-replace').value;
    const useRegex = document.getElementById('editor-use-regex').checked;
    if (!findStr) return;
    
    let content = window.cmEditor.getValue();
    if (useRegex) {
        try { content = content.replace(new RegExp(findStr, 'g'), replaceStr); } 
        catch(e) { return alert("Invalid Regex pattern!"); }
    } else {
        content = content.split(findStr).join(replaceStr);
    }
    window.cmEditor.setValue(content);
};

/**
 * Opens the global search modal for searching across all HTML files in EPUB
 * @returns {void}
 */
window.openGlobalEditSearch = function() {
    if (!window.activeZipEditor) return;
    if (window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('editor-global-search-results').innerHTML = '';
    document.getElementById('editor-global-search-modal').classList.add('active');
};

/**
 * Runs global search across all HTML files in the EPUB
 * Searches file contents using string or regex matching
 * @returns {Promise<void>}
 */
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
            const snippet = content.substring(start, matchIndex + query.length + 40).replace(/</g, '<');
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
            if (window.closeAllModals) window.closeAllModals();
            else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            
            document.querySelectorAll('.file-tree-item').forEach(item => { if (item.title === res.path) item.click(); });
            document.getElementById('editor-find').value = query;
            document.getElementById('editor-use-regex').checked = useRegex;
        };
        resultsContainer.appendChild(div);
    });
};
