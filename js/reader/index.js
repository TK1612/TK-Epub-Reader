// js/reader/index.js

window.activeBookId = null;
window.isSwitchingEngine = false; 

window.getReaderEngine = function() {
    return localStorage.getItem('setting-reader-engine') || 'epubjs';
};

window.syncEngineUI = function() {
    const engine = window.getReaderEngine();
    const readModeSelect = document.getElementById('set-read-mode');
    
    if (readModeSelect) {
        const continuousOption = readModeSelect.querySelector('option[value="continuous"]');
        if (engine === 'foliate') {
            if (continuousOption) {
                continuousOption.disabled = true;
                continuousOption.innerText = "Continuous Scroll (EPUB.js Only)";
            }
            if (readModeSelect.value === 'continuous') readModeSelect.value = 'scrolled';
        } else {
            if (continuousOption) {
                continuousOption.disabled = false;
                continuousOption.innerText = "Continuous Scroll (All Chapters)";
            }
        }
    }
    const engineSelect = document.getElementById('set-reader-engine');
    if (engineSelect) engineSelect.value = engine;
};

window.openReader = async function(bookId) {
    window.activeBookId = bookId;
    document.getElementById('app').style.display = 'none';
    document.getElementById('reader-container').style.display = 'block';
    document.getElementById('chapter-title').innerText = "Loading Engine...";

    window.syncEngineUI();
    const engine = window.getReaderEngine();
    
    try {
        if (engine === 'foliate') {
            if (typeof window.launchFoliateEngine === 'function') await window.launchFoliateEngine(bookId);
            else alert("Foliate engine is still loading. Please wait a moment.");
        } else {
            if (typeof window.launchEpubJsEngine === 'function') await window.launchEpubJsEngine(bookId);
        }
    } catch (e) {
        console.error("Boot error:", e);
        alert("Failed to load this specific book. Check the F12 console for the exact error.");
        window.closeReader(); 
    }
};

window.closeReader = function() {
    const engine = window.getReaderEngine();
    if (engine === 'foliate' && typeof window.destroyFoliateEngine === 'function') window.destroyFoliateEngine();
    else if (typeof window.destroyEpubJsEngine === 'function') window.destroyEpubJsEngine();

    window.activeBookId = null;
    document.getElementById('reader-container').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    
    if (typeof window.loadLibrary === 'function') {
        window.loadLibrary(typeof currentLibraryPage !== 'undefined' ? currentLibraryPage : 1); 
    }
};

window.changeReaderEngine = function() {
    if (window.isSwitchingEngine) return; 
    const newEngine = document.getElementById('set-reader-engine').value;
    if (newEngine === window.getReaderEngine()) return; 
    
    window.isSwitchingEngine = true;
    localStorage.setItem('setting-reader-engine', newEngine);
    window.syncEngineUI();
    
    if (window.activeBookId) {
        const safeBookId = window.activeBookId; 
        try {
            if (window.getReaderEngine() === 'foliate' && window.foliateCurrentCfi) {
                localStorage.setItem('bookmark-' + safeBookId, window.foliateCurrentCfi);
            } else if (window.rendition && typeof window.rendition.currentLocation === 'function') {
                const loc = window.rendition.currentLocation();
                if (loc && loc.start) localStorage.setItem('bookmark-' + safeBookId, loc.start.cfi);
            }
        } catch(e) {}

        window.closeReader(); 
        setTimeout(() => { window.openReader(safeBookId).finally(() => { window.isSwitchingEngine = false; }); }, 250); 
    } else {
        window.isSwitchingEngine = false;
    }
};

window.changeReadMode = function() {
    if (!window.activeBookId || window.isSwitchingEngine) return;
    window.isSwitchingEngine = true;
    const safeBookId = window.activeBookId; 
    
    try {
        if (window.getReaderEngine() === 'foliate' && window.foliateCurrentCfi) {
            localStorage.setItem('bookmark-' + safeBookId, window.foliateCurrentCfi);
        } else if (window.rendition && typeof window.rendition.currentLocation === 'function') {
            const loc = window.rendition.currentLocation();
            if (loc && loc.start) localStorage.setItem('bookmark-' + safeBookId, loc.start.cfi);
        }
    } catch(e) {}
    
    window.closeReader();
    setTimeout(() => { window.openReader(safeBookId).finally(() => { window.isSwitchingEngine = false; }); }, 200);
};

// --- RESTORED GLOBAL UI HANDLERS ---
window.toggleTOC = function() {
    const modal = document.getElementById('toc-modal');
    const isActive = modal.classList.contains('active');
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    
    if (!isActive) {
        modal.classList.add('active');
        setTimeout(() => {
            const activeItem = document.getElementById('active-toc-item');
            if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100); 
    }
};

window.toggleSettings = function() {
    const modal = document.getElementById('settings-modal');
    const isActive = modal.classList.contains('active');
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    
    if (!isActive) {
        window.syncEngineUI(); 
        modal.classList.add('active');
    }
};

window.toggleSearch = function() {
    const modal = document.getElementById('search-modal');
    const isActive = modal.classList.contains('active');
    if(window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    if (!isActive) {
        modal.classList.add('active');
        document.getElementById('global-search-input').focus();
    }
};

// THESE WERE MISSING! Restored them globally.
window.setReaderTheme = function() { 
    if(window.updateSettings) window.updateSettings(); 
};

window.setTextAlign = function(align) {
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById('align-' + align);
    if (targetBtn) targetBtn.classList.add('active');
    if(window.updateSettings) window.updateSettings();
};

window.saveBookmark = function() {
    if (!window.activeBookId) return;
    try {
        if (window.getReaderEngine() === 'foliate' && window.foliateCurrentCfi) {
            localStorage.setItem('bookmark-' + window.activeBookId, window.foliateCurrentCfi);
            alert("Progress manually bookmarked!");
        } else if (window.rendition && typeof window.rendition.currentLocation === 'function') {
            const loc = window.rendition.currentLocation();
            if (loc && loc.start) {
                localStorage.setItem('bookmark-' + window.activeBookId, loc.start.cfi);
                alert("Progress manually bookmarked!");
            }
        }
    } catch (e) { alert("Error saving bookmark."); }
};
