window.toggleSearch = function() {
    window.closeAllModals();
    document.getElementById('search-modal').classList.add('active');
};

window.runGlobalSearch = async function() {
    const query = document.getElementById('global-search-input').value.trim();
    if (!query || !window.book) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<p style="text-align:center;">Searching...</p>';

    let allResults = [];
    const spineItems = window.book.spine.spineItems;

    for (let i = 0; i < spineItems.length; i++) {
        let item = spineItems[i];
        await item.load(window.book.load.bind(window.book));
        let results = item.find(query);
        item.unload();
        
        if (results && results.length > 0) {
            let navItem = window.book.navigation.get(item.href);
            let chapterName = navItem ? navItem.label : `Chapter ${i + 1}`;
            results.forEach(res => allResults.push({ cfi: res.cfi, excerpt: res.excerpt, chapter: chapterName }));
        }
    }

    resultsContainer.innerHTML = '';
    if (allResults.length === 0) {
        resultsContainer.innerHTML = '<p style="color:gray; padding: 10px;">No results found.</p>';
        return;
    }

    allResults.forEach(res => {
        let div = document.createElement('div');
        div.className = 'list-item';
        let highlightedText = res.excerpt.replace(new RegExp(query, 'gi'), `<mark>$&</mark>`);
        div.innerHTML = `<strong style="color:var(--accent); display:block; margin-bottom:5px; font-size:12px;">${res.chapter}</strong><p>${highlightedText}</p>`;
        div.onclick = () => { window.rendition.display(res.cfi); window.closeAllModals(); };
        resultsContainer.appendChild(div);
    });
};

window.toggleEditMode = function() {
    window.closeAllModals();
    if(!window.rendition) return;
    const contents = window.rendition.getContents()[0];
    if(contents) {
        document.getElementById('html-textarea').value = contents.document.body.innerHTML;
        document.getElementById('html-editor').classList.add('active');
    }
};

window.executeReplace = function() {
    const findText = document.getElementById('find-input').value;
    const replaceText = document.getElementById('replace-input').value;
    const textarea = document.getElementById('html-textarea');
    if(!findText) return;
    try {
        const regex = new RegExp(findText, 'g');
        textarea.value = textarea.value.replace(regex, replaceText);
    } catch (e) { 
        alert("Invalid Regex / Search string."); 
    }
};

window.applyHTML = function() {
    const contents = window.rendition.getContents()[0];
    if(contents) {
        contents.document.body.innerHTML = document.getElementById('html-textarea').value;
        window.closeAllModals();
    }
};
