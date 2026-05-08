/**
 * Reader Engine Dispatcher Module
 * Handles engine selection, switching, and dispatches to appropriate engine (EPUB.js or Foliate.js)
 * Preserves engine-specific implementations while providing common UI handlers
 */

window.activeBookId = null;
window.isSwitchingEngine = false; 

/**
 * Get the currently selected reader engine from localStorage
 * @returns {string} 'epubjs' or 'foliate'
 */
window.getReaderEngine = function() {
    return localStorage.getItem('setting-reader-engine') || 'epubjs';
};

/**
 * Sync the UI elements to reflect the current engine selection
 * Disables 'continuous' option for Foliate engine (not supported)
 */
window.syncEngineUI = function() {
    const engine = window.getReaderEngine();
    const readModeSelect = document.getElementById('set-read-mode');
    
    if (readModeSelect) {
        const continuousOption = readModeSelect.querySelector('option[value="continuous"]');
        const paginatedOption = readModeSelect.querySelector('option[value="paginated"]');
        
        if (engine === 'foliate') {
            // Foliate: disable continuous, keep paginated
            if (continuousOption) {
                continuousOption.disabled = true;
                continuousOption.innerText = "Continuous Scroll (EPUB.js Only)";
            }
            if (paginatedOption) {
                paginatedOption.disabled = false;
            }
            if (readModeSelect.value === 'continuous') readModeSelect.value = 'scrolled';
        } else {
            // EPUB.js: disable paginated, keep continuous
            if (continuousOption) {
                continuousOption.disabled = false;
                continuousOption.innerText = "Continuous Scroll (All Chapters)";
            }
            if (paginatedOption) {
                paginatedOption.disabled = true;
            }
            // Force switch away from paginated if somehow selected
            if (readModeSelect.value === 'paginated') {
                readModeSelect.value = 'scrolled';
            }
        }
    }
    const engineSelect = document.getElementById('set-reader-engine');
    if (engineSelect) engineSelect.value = engine;
};

/**
 * Open the reader with the specified book
 * @param {string} bookId - The ID of the book in IndexedDB
 */
window.openReader = async function(bookId) {
    window.activeBookId = bookId;
    document.getElementById('app').style.display = 'none';
    document.getElementById('reader-container').style.display = 'block';
    document.getElementById('chapter-title').innerText = "Loading Engine...";

    // Add reader-active class for iOS handling
    document.body.classList.add('reader-active');

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

/**
 * Close the current reader and cleanup engine resources
 * Dispatches to appropriate engine destroy function
 */
window.closeReader = function() {
    const engine = window.getReaderEngine();
    if (engine === 'foliate' && typeof window.destroyFoliateEngine === 'function') window.destroyFoliateEngine();
    else if (typeof window.destroyEpubJsEngine === 'function') window.destroyEpubJsEngine();

    window.activeBookId = null;
    document.getElementById('reader-container').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    
    // Remove reader-active class for iOS handling
    document.body.classList.remove('reader-active');

    if (typeof window.loadLibrary === 'function') {
        window.loadLibrary(typeof currentLibraryPage !== 'undefined' ? currentLibraryPage : 1);
    }
};

/**
 * Switch reader engine (EPUB.js <-> Foliate)
 * Saves current location, destroys current engine, then restarts with new engine
 */
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

/**
 * Change read mode (continuous/scrolled/paginated)
 * Saves current location, destroys current engine, then restarts with new mode
 */
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

/**
 * Toggle Table of Contents modal
 * Scrolls to active TOC item if opening
 */
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

/**
 * Toggle Settings modal
 * Syncs engine UI when opening
 */
window.toggleSettings = function(e) {
    if (e) e.stopPropagation();
    
    const modal = document.getElementById('settings-modal');
    
    // Simple toggle: if active, close it; if not, open it
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
    } else {
        // Close all other modals first
        if(window.closeAllModals) window.closeAllModals();
        else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        
        window.syncEngineUI(); 
        modal.classList.add('active');
    }
};

/**
 * Toggle Search modal
 * Focuses search input when opening
 */
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

/**
 * Global updateSettings function
 * Saves settings to localStorage and applies them if an engine is active
 */
window.updateSettings = function() {
    // Save settings silently
    try {
        window.saveReaderSettings();
    } catch(e) {
        console.error('Error saving reader settings:', e);
    }
    
    // Delegate to engine-specific updateSettings if available
    // This will apply the settings to the rendered content
    if (typeof window._engineUpdateSettings === 'function') {
        window._engineUpdateSettings();
    }
};

/**
 * Set reader theme (alias for updateSettings)
 */
window.setReaderTheme = function() {
    if(window.updateSettings) window.updateSettings();
};

/**
 * Set text alignment and update settings
 * @param {string} align - 'left', 'center', 'right', or 'justify'
 */
window.setTextAlign = function(align) {
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    // Use data-align attribute for consistency with loadReaderSettings
    const targetBtn = document.querySelector(`.segment-btn[data-align="${align}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    } else {
        // Fallback to ID-based selection
        const fallbackBtn = document.getElementById('align-' + align);
        if (fallbackBtn) fallbackBtn.classList.add('active');
    }
    if(window.updateSettings) window.updateSettings();
};

/**
 * Save current location as bookmark
 * Handles both EPUB.js (CFI) and Foliate (CFI) engines
 */
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
