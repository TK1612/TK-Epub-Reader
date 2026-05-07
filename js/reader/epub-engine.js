window.book = null;
window.rendition = null;
window.taskbarToggleBtn = null;

/**
 * Check if EPUB.js is loaded and available
 * @returns {Promise<void>}
 */
function waitForEpubJs(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (typeof ePub !== 'undefined') {
            resolve();
            return;
        }
        
        let timeoutId = setTimeout(() => {
            reject(new Error('Timeout waiting for EPUB.js to load (10s)'));
        }, timeoutMs);
        
        // Poll for ePub to become available
        const checkInterval = setInterval(() => {
            if (typeof ePub !== 'undefined') {
                clearTimeout(timeoutId);
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        // Clean up interval on timeout
        setTimeout(() => {
            clearInterval(checkInterval);
        }, timeoutMs);
    });
}

window.launchEpubJsEngine = async function(bookId) {
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
        // Wait for EPUB.js to be available
        try {
            await waitForEpubJs(10000);
        } catch (err) {
            throw new Error("EPUB.js failed to load: " + err.message + ". Check your internet connection or try using Foliate.js engine instead.");
        }
        
        const bookData = await localforage.getItem(bookId);
        if (!bookData) throw new Error("Could not retrieve book from database.");
        
        const actualBuffer = bookData.buffer || bookData; 
        if (!actualBuffer || actualBuffer.byteLength === 0) throw new Error("Book file is empty or corrupted.");

        window.book = ePub(actualBuffer);
        const viewer = document.getElementById('viewer');
        viewer.innerHTML = '';

        const readMode = document.getElementById('set-read-mode').value || 'scrolled';
        const isContinuous = (readMode === 'continuous');

        window.rendition = window.book.renderTo(viewer, {
            manager: isContinuous ? "continuous" : "default",
            flow: isContinuous ? "scrolled" : "scrolled",
            width: "100%",
            height: "100%",
            snap: false,
            allowScriptedContent: true
        });

        // Store body style observers so we can disconnect them later
        window._bodyObservers = [];

        // Cache for the CSS template
        let cssTemplateCache = null;
        
        async function loadCSSTemplate() {
            if (cssTemplateCache) return cssTemplateCache;
            try {
                const response = await fetch('css/reader/epub-overrides.css');
                cssTemplateCache = await response.text();
                return cssTemplateCache;
            } catch(e) {
                console.warn('Failed to load CSS template, using fallback');
                return null;
            }
        }

        function injectCSSIntoIframes(cssString) {
            if (!window.rendition) return;
            
            const contents = window.rendition.getContents();
            if (!contents || contents.length === 0) return;
            
            contents.forEach(function(content) {
                if (!content || !content.document || !content.document.head) return;
                
                // Find or create the style element
                let styleEl = content.document.getElementById('custom-override-styles');
                if (!styleEl) {
                    styleEl = content.document.createElement('style');
                    styleEl.id = 'custom-override-styles';
                    content.document.head.appendChild(styleEl);
                }
                
                // Set the CSS content
                styleEl.innerHTML = cssString;
            });
        }

        function setCSSVariablesOnIframes(variables) {
            if (!window.rendition) return;
            
            const contents = window.rendition.getContents();
            if (!contents || contents.length === 0) return;
            
            contents.forEach(function(content) {
                if (!content || !content.document || !content.document.documentElement) return;
                
                // Set CSS custom properties on the html element
                const root = content.document.documentElement;
                Object.keys(variables).forEach(function(varName) {
                    root.style.setProperty(varName, variables[varName]);
                });
            });
        }

        function setupBodyStyleObserver(content) {
            if (!content || !content.document || !content.document.body) return;
            
            const body = content.document.body;
            const isMobile = window.innerWidth <= 768;
            const paddingValue = isMobile ? '16px' : '20px';
            
            // Function to force override styles - aggressively sets both left and right
            const overrideStyles = () => {
                // Clear any inline margins that EPUB.js injected
                body.style.setProperty('margin', '0', 'important');
                body.style.setProperty('margin-left', '0', 'important');
                body.style.setProperty('margin-right', '0', 'important');
                
                // Force equal padding on both sides - use setProperty for each side
                body.style.setProperty('padding', paddingValue, 'important');
                body.style.setProperty('padding-left', paddingValue, 'important');
                body.style.setProperty('padding-right', paddingValue, 'important');
                
                // Prevent the body from stretching to full width
                body.style.setProperty('max-width', '100%', 'important');
                body.style.setProperty('box-sizing', 'border-box', 'important');
            };
            
            // Create a MutationObserver to watch for style changes
            const observer = new MutationObserver(function(mutations) {
                let needsOverride = false;
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'style') {
                        const style = body.getAttribute('style') || '';
                        // Check if EPUB.js injected margins
                        if (style.includes('margin') || style.includes('padding')) {
                            needsOverride = true;
                        }
                    }
                });
                if (needsOverride) {
                    overrideStyles();
                }
            });
            
            // Start observing
            observer.observe(body, { attributes: true, attributeFilter: ['style'] });
            
            // Store observer for cleanup
            window._bodyObservers.push(observer);
            
            // Initial override
            overrideStyles();
            
            // Also set up a continuous enforcement using requestAnimationFrame
            // This ensures the styles stick even if EPUB.js tries to override them
            let enforcing = true;
            function enforceStyles() {
                if (!enforcing) return;
                
                // Check if styles are still correct
                const currentPaddingRight = body.style.getPropertyValue('padding-right');
                const currentPaddingLeft = body.style.getPropertyValue('padding-left');
                const currentMarginLeft = body.style.getPropertyValue('margin-left');
                const currentMarginRight = body.style.getPropertyValue('margin-right');
                
                // If either padding is not what we want, re-apply
                if (currentPaddingRight !== paddingValue || 
                    currentPaddingLeft !== paddingValue ||
                    currentMarginLeft !== '0px' ||
                    currentMarginRight !== '0px') {
                    overrideStyles();
                }
                
                requestAnimationFrame(enforceStyles);
            }
            
            // Start enforcement
            requestAnimationFrame(enforceStyles);
            
            // Store the enforcement stop function
            body._stopEnforcement = () => { enforcing = false; };
        }

        function setupAllObservers() {
            if (!window.rendition) return;
            
            const contents = window.rendition.getContents();
            if (!contents || contents.length === 0) return;
            
            contents.forEach(function(content) {
                setupBodyStyleObserver(content);
            });
        }

        if (!window._contentHookRegistered) {
            window.rendition.hooks.content.register(function(content) {
                // Inject CSS when new content loads
                const cssTemplate = cssTemplateCache;
                if (cssTemplate) {
                    if (!content.document.getElementById('custom-override-styles')) {
                        const styleEl = content.document.createElement('style');
                        styleEl.id = 'custom-override-styles';
                        content.document.head.appendChild(styleEl);
                        styleEl.innerHTML = cssTemplate;
                    }
                }
                
                // Set CSS variables
                if (window._currentCssVariables) {
                    const root = content.document.documentElement;
                    Object.keys(window._currentCssVariables).forEach(function(varName) {
                        root.style.setProperty(varName, window._currentCssVariables[varName]);
                    });
                }
                
                // Setup observer for this content
                setupBodyStyleObserver(content);
                
                // Force override after a short delay to catch late injections
                setTimeout(() => {
                    if (content && content.document && content.document.body) {
                        const isMobile = window.innerWidth <= 768;
                        const paddingValue = isMobile ? '16px' : '20px';
                        const body = content.document.body;
                        body.style.setProperty('margin', '0', 'important');
                        body.style.setProperty('margin-left', '0', 'important');
                        body.style.setProperty('margin-right', '0', 'important');
                        body.style.setProperty('padding', paddingValue, 'important');
                        body.style.setProperty('padding-left', paddingValue, 'important');
                        body.style.setProperty('padding-right', paddingValue, 'important');
                    }
                }, 100);
            });
            window._contentHookRegistered = true;
        }

        window._engineUpdateSettings = async function() {
            if (!window.rendition) return;

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

            // Set container background - this will show through the transparent iframe
            document.getElementById('reader-container').style.backgroundColor = bgColor;
            // Make viewer transparent so the container background shows through
            viewer.style.backgroundColor = 'transparent';

            // Get text align from active button - support ALL options (left, center, right, justify)
            const activeAlignBtn = document.querySelector('.segment-btn.active');
            let textAlign = 'left'; // default
            
            if (activeAlignBtn) {
                // First try data-align attribute, then fallback to ID-based detection
                if (activeAlignBtn.dataset && activeAlignBtn.dataset.align) {
                    textAlign = activeAlignBtn.dataset.align;
                } else if (activeAlignBtn.id) {
                    // Fallback: extract from ID (e.g., "align-center" -> "center")
                    const match = activeAlignBtn.id.match(/align-(.+)/);
                    if (match) textAlign = match[1];
                }
            }

            const cssTemplate = await loadCSSTemplate();
            
            if (cssTemplate) {
                injectCSSIntoIframes(cssTemplate);
            }
            
            const cssVariables = {
                '--bg-color': bgColor,
                '--text-color': color,
                '--font-family': fontFamily,
                '--font-size': fontSize,
                '--line-height': lineHeight,
                '--text-align': textAlign,
                '--para-spacing': paraSpacing,
                '--indent': indent
            };
            
            window._currentCssVariables = cssVariables;
            
            setCSSVariablesOnIframes(cssVariables);
            
            setupAllObservers();

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

        // Display the book
        try {
            await window.rendition.display();
        } catch (displayErr) {
            console.error("Display error:", displayErr);
            throw new Error("Failed to display the book. The EPUB format may be incompatible.");
        }

        // Build TOC
        try {
            const toc = await window.book.loaded.navigation;
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';
            
            if (toc && toc.toc && typeof toc.toc.forEach === 'function') {
                toc.toc.forEach(chapter => {
                    const li = document.createElement('li');
                    li.className = 'list-item';
                    li.innerText = chapter.label;
                    li.dataset.href = chapter.href;
                    li.style.paddingLeft = '15px';
                    
                    li.onclick = () => {
                        if (window.rendition) window.rendition.display(chapter.href);
                        if (window.closeAllModals) window.closeAllModals();
                    };
                    tocList.appendChild(li);
                });
            }
        } catch (tocErr) {
            console.warn("Failed to load TOC:", tocErr);
        }

        // Update chapter title on location change
        window.rendition.on('relocate', (location) => {
            try {
                const chapterName = location.start?.display || "Reading...";
                document.getElementById('chapter-title').innerText = chapterName;
                
                // Save progress
                localStorage.setItem('bookmark-' + bookId, location.start.cfi);
                localStorage.setItem('progress-' + bookId, JSON.stringify({ 
                    chapter: chapterName, 
                    percentage: location.start.percentage || 0 
                }));
                
                // Highlight active TOC item
                const currentHref = location.start?.href || null;
                if (currentHref) {
                    document.querySelectorAll('#toc-list .list-item').forEach(li => {
                        if (li.dataset.href && li.dataset.href === currentHref) {
                            li.style.color = 'var(--accent)';
                            li.style.fontWeight = 'bold';
                            li.style.borderLeft = '3px solid var(--accent)';
                            li.style.paddingLeft = '25px';
                            li.id = "active-toc-item";
                        } else {
                            li.style.color = '';
                            li.style.fontWeight = 'normal';
                            li.style.borderLeft = 'none';
                            li.style.paddingLeft = '15px';
                            if (li.id === "active-toc-item") li.removeAttribute('id');
                        }
                    });
                }
            } catch (e) {
                console.warn("Error in relocate handler:", e);
            }
        });

        // Click handler for navigation
        window.rendition.on('click', (e) => {
            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');
            if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) taskbar.classList.toggle('hidden');
        });

        // Apply initial settings
        if (window._engineUpdateSettings) window._engineUpdateSettings();

        // Restore last position if available
        try {
            const lastCfi = localStorage.getItem('bookmark-' + bookId);
            if (lastCfi && window.rendition) {
                await window.rendition.display(lastCfi);
            }
        } catch (e) {
            console.warn("Failed to restore position:", e);
        }

    } catch (error) {
        console.error("EPUB.js engine error:", error);
        throw error;
    }
};

window.destroyEpubJsEngine = function() {
    // Disconnect all body observers
    if (window._bodyObservers && window._bodyObservers.length > 0) {
        window._bodyObservers.forEach(observer => {
            try { observer.disconnect(); } catch(e) {}
        });
        window._bodyObservers = [];
    }
    
    // Destroy the book
    if (window.book) {
        try {
            window.book.destroy();
        } catch(e) {}
        window.book = null;
    }
    
    window.rendition = null;
    window._currentCssVariables = null;
};
