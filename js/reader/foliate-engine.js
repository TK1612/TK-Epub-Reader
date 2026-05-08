// Foliate.js engine - Module version for iOS compatibility
// This file must be loaded as a module (type="module" in HTML)

// Import Foliate.js - this will only work as a module
let foliateLoaded = false;
let foliateLoadPromise = null;

async function loadFoliateModule() {
    if (foliateLoadPromise) return foliateLoadPromise;
    
    foliateLoadPromise = new Promise(async (resolve, reject) => {
        try {
            // Try to import Foliate.js
            // Note: This only works if this file is loaded as a module
            await import('./foliate-view.js');
            
            // Check if the custom element is registered
            setTimeout(() => {
                if (customElements.get('foliate-view')) {
                    foliateLoaded = true;
                    window._foliateLoaded = true;
                    console.log('Foliate.js loaded successfully as module');
                    resolve();
                } else {
                    reject(new Error('Foliate.js loaded but foliate-view not registered'));
                }
            }, 500);
        } catch (err) {
            console.error('Failed to load Foliate.js module:', err);
            reject(err);
        }
    });
    
    return foliateLoadPromise;
}

// Try to load Foliate on module script initialization
try {
    loadFoliateModule().catch(e => {
        console.warn('Foliate module load failed:', e.message);
        window._foliateLoadError = e.message;
    });
} catch (e) {
    console.warn('Foliate module initialization failed:', e.message);
    window._foliateLoadError = e.message;
}

window.foliateView = null;
window.foliateCurrentCfi = null;
window.taskbarToggleBtn = null;

/**
 * Wait for Foliate custom element to be defined with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<void>}
 */
function waitForFoliateDefinition(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        // Check if already defined
        if (customElements.get('foliate-view')) {
            resolve();
            return;
        }
        
        // Check if there was a load error
        if (window._foliateLoadError) {
            reject(new Error(window._foliateLoadError));
            return;
        }
        
        let timeoutId;
        
        // Set timeout
        timeoutId = setTimeout(() => {
            reject(new Error('Timeout waiting for Foliate.js to load (10s). Try EPUB.js engine instead.'));
        }, timeoutMs);
        
        // Use the standard whenDefined() which returns a promise
        customElements.whenDefined('foliate-view').then(() => {
            clearTimeout(timeoutId);
            resolve();
        }).catch((err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
}

window.launchFoliateEngine = async function(bookId) {
    // --- LOAD SETTINGS BEFORE ENGINE BOOTS ---
    window.loadReaderSettings();
    
    // --- SAVE READ MODE BEFORE THE RESTART LOOP HAPPENS ---
    const modeDropdown = document.getElementById('set-read-mode');
    if (modeDropdown && !modeDropdown.dataset.modeSaved) {
        modeDropdown.addEventListener('change', function() {
            try {
                const settings = JSON.parse(localStorage.getItem('reader-settings') || {});
                settings.readMode = this.value;
                localStorage.setItem('reader-settings', JSON.stringify(settings));
            } catch(e) {}
        });
        modeDropdown.dataset.modeSaved = "true";
    }

    try {
        const bookData = await localforage.getItem(bookId);
        if (!bookData) throw new Error("Could not retrieve book from database.");
        
        const actualBuffer = bookData.buffer || bookData; 
        if (!actualBuffer || actualBuffer.byteLength === 0) throw new Error("Book file is empty or corrupted.");

        const viewerContainer = document.getElementById('viewer');
        viewerContainer.innerHTML = ''; 
        
        // Wait for foliate-view to be defined with timeout
        try {
            await waitForFoliateDefinition(10000);
        } catch (err) {
            throw new Error("Foliate.js failed to load: " + err.message);
        }
        
        window.foliateView = document.createElement('foliate-view');
        window.foliateView.style.width = '100%';
        window.foliateView.style.height = '100%';
        window.foliateView.style.display = 'block';
        
        const readMode = document.getElementById('set-read-mode').value;
        const targetLayout = (readMode === 'continuous' || readMode === 'scrolled') ? 'scrolled' : 'paginated';
        window.foliateView.setAttribute('layout', targetLayout);
        
        viewerContainer.appendChild(window.foliateView);

        // Foliate-specific: Create rendition-like interface
        window.rendition = {
            next: () => { if (window.foliateView) window.foliateView.next(); },
            prev: () => { if (window.foliateView) window.foliateView.prev(); },
            display: (loc) => { if (window.foliateView) window.foliateView.goTo(loc); },
            currentLocation: () => { return { start: { cfi: window.foliateCurrentCfi } }; }
        };

        // Cache for the CSS template
        let foliateCssTemplateCache = null;
        
        async function loadFoliateCSSTemplate() {
            if (foliateCssTemplateCache) return foliateCssTemplateCache;
            try {
                const response = await fetch('css/reader/foliate-overrides.css');
                foliateCssTemplateCache = await response.text();
                return foliateCssTemplateCache;
            } catch(e) {
                console.warn('Failed to load Foliate CSS template, using fallback');
                return null;
            }
        }

        window._engineUpdateSettings = async function() {
            if (!window.foliateView) return;

            // --- SAVE SETTINGS SILENTLY ON CHANGE ---
            window.saveReaderSettings();

            const theme = document.getElementById('set-reader-theme').value;
            const fontSize = document.getElementById('set-font').value + 'px';
            const lineHeight = document.getElementById('set-line').value;
            const paraSpacing = document.getElementById('set-para-spacing').value + 'em';
            const indent = document.getElementById('set-indent').value + 'em';
            const fontFamily = document.getElementById('set-font-family').value;

            if(document.getElementById('val-font')) document.getElementById('val-font').innerText = fontSize;
            if(document.getElementById('val-line')) document.getElementById('val-line').innerText = lineHeight;
            if(document.getElementById('val-para-spacing')) document.getElementById('val-para-spacing').innerText = paraSpacing;
            if(document.getElementById('val-indent')) document.getElementById('val-indent').innerText = indent;

            // Dynamic Background Theming using shared helper
            const { bgColor, color } = window.getThemeColors(theme);

            document.getElementById('reader-container').style.backgroundColor = bgColor;
            viewerContainer.style.backgroundColor = bgColor;

            const currentReadMode = document.getElementById('set-read-mode').value;
            const currentLayout = (currentReadMode === 'continuous' || currentReadMode === 'scrolled') ? 'scrolled' : 'paginated';
            if (window.foliateView.renderer) {
                window.foliateView.renderer.setAttribute('flow', currentLayout);
            }

            // Get text align from active button
            const activeAlignBtn = document.querySelector('.segment-btn.active');
            let alignValue = 'left';
            
            if (activeAlignBtn) {
                if (activeAlignBtn.dataset && activeAlignBtn.dataset.align) {
                    alignValue = activeAlignBtn.dataset.align;
                } else if (activeAlignBtn.id) {
                    const match = activeAlignBtn.id.match(/align-(.+)/);
                    if (match) alignValue = match[1];
                }
            }

            const cssTemplate = await loadFoliateCSSTemplate();
            
            if (cssTemplate) {
                const fullCSS = cssTemplate + '\n:root {\n' +
                    `    --bg-color: ${bgColor};\n` +
                    `    --text-color: ${color};\n` +
                    `    --font-family: ${fontFamily};\n` +
                    `    --font-size: ${fontSize};\n` +
                    `    --line-height: ${lineHeight};\n` +
                    `    --text-align: ${alignValue};\n` +
                    `    --para-spacing: ${paraSpacing};\n` +
                    `    --indent: ${indent};\n` +
                    `}\n`;
                
                if (window.foliateView.renderer && typeof window.foliateView.renderer.setStyles === 'function') {
                    try {
                        window.foliateView.renderer.setStyles(fullCSS);
                    } catch(e) {
                        console.warn("Foliate setStyles failed:", e);
                    }
                }
            }

            // Sync Floating Button Settings
            const showFloatCheckbox = document.getElementById('set-show-float-btn');
            const taskbarElement = document.getElementById('bottom-taskbar');
            
            if (window.taskbarToggleBtn) {
                if (showFloatCheckbox && !showFloatCheckbox.checked) {
                    window.taskbarToggleBtn.style.display = 'none';
                } else {
                    window.taskbarToggleBtn.style.display = 'flex';
                    if (taskbarElement) {
                        const taskbarCSS = window.getComputedStyle(taskbarElement);
                        window.taskbarToggleBtn.style.backgroundColor = taskbarCSS.backgroundColor;
                        window.taskbarToggleBtn.style.color = taskbarCSS.color;
                        window.taskbarToggleBtn.style.borderColor = taskbarCSS.borderTopColor !== 'rgba(0, 0, 0, 0)' ? taskbarCSS.borderTopColor : '#3f3f46';
                    }
                }
            }
        };

        const blob = new Blob([actualBuffer], { type: 'application/epub+zip' });
        const file = new File([blob], "book.epub", { type: 'application/epub+zip' });
        
        try {
            await window.foliateView.open(file);
        } catch (openErr) {
            throw new Error("Foliate failed to parse this EPUB file.");
        }
        
        document.getElementById('chapter-title').innerText = "Reading...";

        // Build TOC
        const tocList = document.getElementById('toc-list');
        tocList.innerHTML = '';
        if (window.foliateView.book.toc && typeof window.foliateView.book.toc.forEach === 'function') {
            window.foliateView.book.toc.forEach(chapter => {
                const li = document.createElement('li');
                li.className = 'list-item foliate-toc-item';
                li.innerText = chapter.label;
                li.dataset.href = chapter.href; 
                li.style.paddingLeft = '15px'; 
                
                li.onclick = () => { window.foliateView.goTo(chapter.href); if (window.closeAllModals) window.closeAllModals(); };
                tocList.appendChild(li);
            });
        }

        // Handle relocate event
        window.foliateView.addEventListener('relocate', (e) => {
            const loc = e.detail;
            window.foliateCurrentCfi = loc.cfi;
            localStorage.setItem('bookmark-' + bookId, loc.cfi);
            
            let chapterName = "Reading...";
            if (loc.tocItem && loc.tocItem.label) chapterName = loc.tocItem.label;
            document.getElementById('chapter-title').innerText = chapterName;
            
            localStorage.setItem('progress-' + bookId, JSON.stringify({ 
                chapter: chapterName, 
                percentage: loc.fraction || 0 
            }));
        });

        // Apply initial settings
        if (window._engineUpdateSettings) window._engineUpdateSettings();

    } catch (error) {
        console.error("Foliate engine error:", error);
        throw error;
    }
};

window.destroyFoliateEngine = function() {
    if (window.foliateView) {
        try {
            window.foliateView.remove();
        } catch(e) {}
        window.foliateView = null;
    }
    window.foliateCurrentCfi = null;
    window.rendition = null;
};
