/**
 * Editor Diagnostics Module
 * Groups all debugging tools: spellcheck modal, cleaner modal,
 * EPUB cleaner runner, and debugger.
 */

/**
 * Opens the spellcheck modal and scans all HTML files for uncommon words
 * Builds a word frequency map to identify potential spelling errors
 * @returns {Promise<void>}
 */
window.openSpellcheckModal = async function() {
    if (!window.activeZipEditor) return;
    
    const listEl = document.getElementById('spellcheck-list');
    listEl.innerHTML = '<div style="padding:30px; text-align:center;"><i class="ph ph-spinner ph-spin" style="font-size:32px; color:var(--accent);"></i><p style="margin-top:10px; color:var(--text-muted);">Scanning entire book for uncommon words...</p></div>';
    
    window.openEditorModal('editor-spellcheck-modal');

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
            window.runGlobalEditSearch();
            document.getElementById('editor-global-search-modal').classList.add('active');
        };
        listEl.appendChild(div);
    });
};

/**
 * Opens the EPUB Cleaner modal
 * Clears previous console output and displays the modal
 * @returns {void}
 */
window.openCleanerModal = function() {
    if (!window.activeZipEditor) return;
    document.getElementById('cleaner-console').innerHTML = 'Ready to scan. Select options above and click Run.';
    window.openEditorModal('editor-cleaner-modal');
};

/**
 * Runs the EPUB Cleaner to remove unwanted elements from HTML/XML files
 * Options: hidden paragraphs, inline base64 images, orphaned strings, nested <p> tags, unclosed tags
 * @returns {Promise<void>}
 */
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
            const re = /<p\s+style=['"][^'"]*height:\s*0px;[^>]*>[\s\S]*?<\/p>/gi;
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
                if (item.tag === 'html' || item.tag === 'body' || item.tag === '?xml') continue; 
                unclosedTags.push(`<${item.tag}> opened at Line ${item.pos.line}, Col ${item.pos.col} but never closed.`);
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

/**
 * Runs the EPUB Debugger to scan for errors and warnings
 * Checks: OPF manifest, broken links, unclosed tags, missing images, CSS errors
 * @returns {Promise<void>}
 */
window.runEpubDebugger = async function() {
    if (!window.activeZipEditor) return;
    const consoleEl = document.getElementById('debug-console');
    consoleEl.innerHTML = '<div class="debug-log-item">Starting Comprehensive Diagnostics...</div>';
    
    const logMsg = (html) => consoleEl.insertAdjacentHTML('beforeend', html);
    
    window.openEditorModal('editor-debug-modal');

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
            if (window.closeAllModals) window.closeAllModals();
            else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            
            let targetLi = null;
            document.querySelectorAll('.file-tree-item').forEach(item => {
                if (item.title === path) targetLi = item;
            });
            
            if (targetLi) {
                let folderContent = targetLi.closest('.folder-content');
                if (folderContent && !folderContent.classList.contains('open')) {
                    folderContent.classList.add('open');
                    let header = folderContent.previousElementSibling;
                    if (header) header.classList.add('open');
                }
            }
            
            await window.loadFileIntoEditor(path, targetLi);
            
            if (lineNum >= 0) {
                setTimeout(() => {
                    if (!window.cmEditor) return;
                    
                    window.cmEditor.refresh(); 
                    const safeLine = Math.max(0, Math.min(lineNum, window.cmEditor.lineCount() - 1));
                    
                    window.cmEditor.focus();
                    window.cmEditor.setCursor({line: safeLine, ch: 0});
                    
                    try {
                        const t = window.cmEditor.charCoords({line: safeLine, ch: 0}, "local").top; 
                        const h = window.cmEditor.getScrollerElement().offsetHeight / 2; 
                        window.cmEditor.scrollTo(null, t - h - 5);
                    } catch(e) {}
                    
                    window.cmEditor.addLineClass(safeLine, 'background', 'error-line-highlight');
                    setTimeout(() => window.cmEditor.removeLineClass(safeLine, 'background', 'error-line-highlight'), 4000);
                }, 300); 
            }
        };
        consoleEl.appendChild(div);
        if (isWarning) warningsFound++; else errorsFound++;
    };

    const opfPath = window.findOpfPath();
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
