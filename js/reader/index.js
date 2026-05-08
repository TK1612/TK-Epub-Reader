/**
 * Reader Engine Dispatcher Module
 * Handles engine selection, switching, and dispatches to appropriate engine (EPUB.js or Foliate.js)
 * Preserves engine-specific implementations while providing common UI handlers
 */

window.activeBookId = null;
window.isSwitchingEngine = false; 
window._engineLaunchTimeout = null;

/**
 * Detect if the user is on iOS
 * @returns {boolean}
 */
window.isIOS = function() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * Get the currently selected reader engine from localStorage
 * Defaults to 'foliate' on iOS, 'epubjs' on other platforms
 * @returns {string} 'epubjs' or 'foliate'
 */
window.getReaderEngine = function() {
    const saved = localStorage.getItem('setting-reader-engine');
    if (saved) return saved;
    
    // Default to Foliate on iOS (better compatibility)
    if (window.isIOS()) {
        return 'foliate';
    }
    return 'epubjs';
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
            // Gray out continuous scroll for Foliate (not supported)
            if (continuousOption) {
                continuousOption.disabled = true;
                continuousOption.innerText = "Continuous Scroll (EPUB.js Only)";
            }
            // Reset to scrolled if continuous was selected
            if (readModeSelect.value === 'continuous') readModeSelect.value = 'scrolled';
        } else {
            if (continuousOption) {
                continuousOption.disabled = false;
                continuousOption.innerText = "Continuous Scroll (All Chapters)";
            }
        }
        
        // Gray out paginated for EPUB.js (currently unusable)
        if (paginatedOption) {
            paginatedOption.disabled = true;
            paginatedOption.innerText = "Paginated (Disabled)";
        }
        // Reset to scrolled if paginated was selected
        if (readModeSelect.value === 'paginated') readModeSelect.value = 'scrolled';
    }
    
    const engineSelect = document.getElementById('set-reader-engine');
    if (engineSelect) engineSelect.value = engine;
};

/**
 * Open the reader with the specified book
 * @param {string} bookId - The ID of the book in IndexedDB
 */
window.openReader = function(bookId) {
    window.activeBookId = bookId;
    document.getElementById('app').style.display = 'none';
    document.getElementById('reader-container').style.display = 'block';
    document.getElementById('chapter-title').innerText = "Loading Engine...";

    window.syncEngineUI();
    const engine = window.getReaderEngine();
    
    // Set a global timeout to detect if engine is stuck (iOS Safari issue)
    window._engineLaunchTimeout = setTimeout(() => {
        console.error("Engine launch timeout - stuck for 15 seconds");
        alert("The reader engine appears to be stuck. This may be due to iOS Safari compatibility issues. Try switching to the other engine in Settings.");
        window.closeReader();
    }, 15000); // 15 second timeout
    
    // Launch engine with async wrapper
    const launchPromise = (async () => {
        try {
            if (engine === 'foliate') {
                if (typeof window.launchFoliateEngine === 'function') {
                    await window.launchFoliateEngine(bookId);
                } else {
                    throw new Error("Foliate engine not available. Try refreshing the page or switch to EPUB.js engine.");
                }
            } else {
                if (typeof window.launchEpubJsEngine === 'function') {
                    await window.launchEpubJsEngine(bookId);
                } else {
                    throw new Error("EPUB.js engine not available. Try refreshing the page or switch to Foliate engine.");
                }
            }
            // Clear timeout on success
            if (window._engineLaunchTimeout) {
                clearTimeout(window._engineLaunchTimeout);
                window._engineLaunchTimeout = null;
            }
            document.getElementById('chapter-title').innerText = "Ready";
        } catch (e) {
            // Clear timeout on error
            if (window._engineLaunchTimeout) {
                clearTimeout(window._engineLaunchTimeout);
                window._engineLaunchTimeout = null;
            }
            console.error("Boot error:", e);
            const errorMsg = e.message || "Unknown error occurred";
            alert("Failed to load book: " + errorMsg);
            window.closeReader(); 
        }
    })();
    
    return launchPromise;
};

/**
 * Close the current reader and cleanup engine resources
 * Dispatches to appropriate engine destroy function
 */
window.closeReader = function() {
    // Clear any pending timeout
    if (window._engineLaunchTimeout) {
        clearTimeout(window._engineLaunchTimeout);
        window._engineLaunchTimeout = null;
    }
    
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
