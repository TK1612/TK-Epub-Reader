window.toggleSearch = function() {
    window.closeAllModals();
    const modal = document.getElementById('search-modal');
    const isActive = modal.classList.contains('active');
    if(!isActive) {
        modal.classList.add('active');
        setTimeout(() => {
            const activeItem = document.getElementById('active-toc-item');
            if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100); 
    }
};

window.runGlobalSearch = async function() {
    if (!window.book || !window.book.spine) return alert("Search is currently not available.");
    
    const query = document.getElementById('global-search-input').value;
    if (!query) return;
    
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="padding:10px;">Searching...</div>';
    
    try {
        await window.book.ready;
        
        if (!window.book.spine || !window.book.spine.spineItems) {
             return resultsContainer.innerHTML = '<div style="padding:10px;">Error: Book structure not readable.</div>';
        }
        
        let allMatches = [];
        
        for (const item of window.book.spine.spineItems) {
            try {
                // Load one chapter into memory
                await item.load(window.book.load.bind(window.book));
                
                // Use EPUB.js native .find() to get exact coordinates (CFIs)
                const matches = item.find(query) || [];
                
                // Instantly unload it to free memory for the next chapter
                item.unload(); 
                
                if (matches.length > 0) {
                    const rawHref = item.href || "Unknown File";
                    const fileName = decodeURIComponent(rawHref.split('/').pop().split('#')[0]);
                    let chapterLabel = fileName !== "Unknown File" ? fileName : "Unknown Chapter";
                    
                    if (window.book.navigation && window.book.navigation.toc) {
                        const findInToc = (items) => {
                            for (let t of items) {
                                if (t.href && decodeURIComponent(t.href).includes(fileName)) return t.label ? t.label.trim() : null;
                                if (t.subitems) { let sub = findInToc(t.subitems); if (sub) return sub; }
                            }
                            return null;
                        };
                        let foundLabel = findInToc(window.book.navigation.toc);
                        if (foundLabel) chapterLabel = foundLabel;
                    }
                    
                    matches.forEach(match => {
                        allMatches.push({
                            cfi: match.cfi, 
                            href: item.href, 
                            snippet: match.excerpt || "", 
                            chapter: chapterLabel,
                            file: fileName
                        });
                    });
                }
            } catch(e) {
                console.warn("Skipped section during search", e);
            }
        }
        
        resultsContainer.innerHTML = '';
        if (allMatches.length === 0) return resultsContainer.innerHTML = '<div style="padding:10px;">No results found.</div>';
        
        allMatches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-item';
            
            let safeSnippet = match.snippet;
            if (safeSnippet.length > 80) safeSnippet = safeSnippet.substring(0, 80) + "...";
            
            li.innerHTML = `
                <div style="font-weight: 600; color: var(--accent); margin-bottom: 4px; font-size: 13px;">
                    ${match.chapter} <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">(${match.file})</span>
                </div>
                <span style="font-size: 13px;">...${safeSnippet.replace(new RegExp(query, 'gi'), m => `<strong style="color:var(--accent); background:rgba(59,130,246,0.2); padding:0 2px; border-radius:3px;">${m}</strong>`)}...</span>
            `;
            
            li.onclick = () => { 
                // Navigate instantly to the exact text coordinate!
                if (match.cfi) {
                    window.rendition.display(match.cfi).catch(() => window.rendition.display(match.href));
                } else if (match.href) {
                    window.rendition.display(match.href);
                }
                if (window.closeAllModals) window.closeAllModals(); 
            };
            resultsContainer.appendChild(li);
        });
    } catch (e) { 
        resultsContainer.innerHTML = '<div style="padding:10px; color:red;">Search failed.</div>'; 
        console.error("Search Error:", e);
    }
};
