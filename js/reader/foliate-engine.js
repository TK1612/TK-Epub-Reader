// js/reader/foliate-engine.js
import 'https://cdn.jsdelivr.net/gh/johnfactotum/foliate-js@main/view.js';

window.foliateView = null;
window.foliateCurrentCfi = null;
window.foliateToggleBtn = null; // Stores our new button

window.launchFoliateEngine = async function(bookId) {
    try {
        const bookData = await localforage.getItem(bookId);
        if (!bookData || !bookData.buffer) return alert("Error loading book data.");

        const viewerContainer = document.getElementById('viewer');
        viewerContainer.innerHTML = ''; 

        // 1. Initialize Foliate Web Component Safely
        await customElements.whenDefined('foliate-view');
        window.foliateView = document.createElement('foliate-view');
        window.foliateView.style.width = '100%';
        window.foliateView.style.height = '100%';
        window.foliateView.style.display = 'block';

        const readMode = document.getElementById('set-read-mode').value;
        const targetLayout = (readMode === 'continuous' || readMode === 'scrolled') ? 'scrolled' : 'paginated';
        window.foliateView.setAttribute('layout', targetLayout);
        
        viewerContainer.appendChild(window.foliateView);

        // 2. Map UI Buttons
        window.rendition = {
            next: () => { if (window.foliateView) window.foliateView.next(); },
            prev: () => { if (window.foliateView) window.foliateView.prev(); },
            display: (loc) => { if (window.foliateView) window.foliateView.goTo(loc); },
            currentLocation: () => { return { start: { cfi: window.foliateCurrentCfi } }; }
        };

        // 3. Settings Updater
        window.updateSettings = function() {
            if (!window.foliateView) return;
            const theme = document.getElementById('set-reader-theme').value;
            const fontSize = document.getElementById('set-font').value + 'px';
            const lineHeight = document.getElementById('set-line').value;
            const paraSpacing = document.getElementById('set-para-spacing').value + 'em';
            const indent = document.getElementById('set-indent').value + 'em';
            const fontFamily = document.getElementById('set-font-family').value;
            const textColor = document.getElementById('set-text-color').value;
            const alignBtn = document.querySelector('.segment-btn.active');
            const textAlign = alignBtn ? (alignBtn.id === 'align-center' ? 'center' : 'left') : 'left';

            document.getElementById('val-font').innerText = fontSize;
            document.getElementById('val-line').innerText = lineHeight;
            document.getElementById('val-para-spacing').innerText = paraSpacing;
            document.getElementById('val-indent').innerText = indent;

            let bgColor = '#18181b'; let color = textColor;
            if (theme === 'light') { bgColor = '#ffffff'; color = textColor === '#e4e4e7' ? '#000000' : textColor; }
            else if (theme === 'paper') { bgColor = '#f4ecd8'; color = textColor === '#e4e4e7' ? '#333333' : textColor; }
            else if (theme === 'blue') { bgColor = '#e8f4f8'; color = textColor === '#e4e4e7' ? '#1a365d' : textColor; }
            document.getElementById('reader-container').style.backgroundColor = bgColor;

            const currentReadMode = document.getElementById('set-read-mode').value;
            const currentLayout = (currentReadMode === 'continuous' || currentReadMode === 'scrolled') ? 'scrolled' : 'paginated';
            if (window.foliateView.renderer) {
                window.foliateView.renderer.setAttribute('flow', currentLayout);
            }

            const cssString = `
                @namespace epub "http://www.idpf.org/2007/ops";
                html, body { 
                    background: ${bgColor} !important; 
                    color: ${color} !important; 
                    font-family: ${fontFamily} !important; 
                    font-size: ${fontSize} !important; 
                    line-height: ${lineHeight} !important; 
                    text-align: ${textAlign} !important; 
                }
                p { margin-bottom: ${paraSpacing} !important; text-indent: ${indent} !important; }
            `;
            
            if (window.foliateView.renderer && typeof window.foliateView.renderer.setStyles === 'function') {
                try { window.foliateView.renderer.setStyles(cssString); } catch(e) {}
            }
        };

        // 4. Load File Safely
        const blob = new Blob([bookData.buffer], { type: 'application/epub+zip' });
        const file = new File([blob], "book.epub", { type: 'application/epub+zip' });
        await window.foliateView.open(file);

        // 5. Build TOC
        const tocList = document.getElementById('toc-list');
        tocList.innerHTML = '';
        if (window.foliateView.book.toc) {
            window.foliateView.book.toc.forEach(chapter => {
                const li = document.createElement('li');
                li.className = 'list-item foliate-toc-item';
                li.innerText = chapter.label;
                li.dataset.href = chapter.href; 
                li.onclick = () => {
                    window.foliateView.goTo(chapter.href);
                    if (window.closeAllModals) window.closeAllModals();
                };
                tocList.appendChild(li);
            });
        }

        // 6. Track Progress & Bookmarks
        window.foliateView.addEventListener('relocate', (e) => {
            const loc = e.detail;
            window.foliateCurrentCfi = loc.cfi;
            localStorage.setItem('bookmark-' + bookId, loc.cfi);
            
            let chapterName = "Reading...";
            let currentHref = loc.href || null;

            if (loc.tocItem) {
                if (loc.tocItem.label) chapterName = loc.tocItem.label;
                if (loc.tocItem.href) currentHref = loc.tocItem.href;
            }
            document.getElementById('chapter-title').innerText = chapterName;
            localStorage.setItem('progress-' + bookId, JSON.stringify({ chapter: chapterName, percentage: loc.fraction || 0 }));

            const targetPath = currentHref ? currentHref.split('#')[0].replace(/^\//, '') : null;
            document.querySelectorAll('#toc-list .list-item').forEach(li => {
                const itemPath = li.dataset.href ? li.dataset.href.split('#')[0].replace(/^\//, '') : null;
                if (itemPath && targetPath && itemPath === targetPath) {
                    li.style.color = 'var(--accent)';
                    li.style.fontWeight = 'bold';
                    li.style.borderLeft = '3px solid var(--accent)';
                    li.style.paddingLeft = '10px';
                    li.id = "active-toc-item"; 
                } else {
                    li.style.color = '';
                    li.style.fontWeight = 'normal';
                    li.style.borderLeft = 'none';
                    li.style.paddingLeft = '0px';
                    if (li.id === "active-toc-item") li.removeAttribute('id');
                }
            });
        });

        // ==========================================
        // 7. NEW: THE DEDICATED TASKBAR TOGGLE BUTTON
        // ==========================================
        
        // Remove old button if it accidentally carried over
        if (document.getElementById('foliate-taskbar-toggle')) {
            document.getElementById('foliate-taskbar-toggle').remove();
        }

        const btn = document.createElement('button');
        btn.id = 'foliate-taskbar-toggle';
        btn.innerHTML = '<i class="ph ph-caret-down"></i>';
        
        // Style the floating button to match your UI
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '80px', // Starts above the visible taskbar
            right: '20px',
            zIndex: '9999',
            width: '45px',
            height: '45px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface, #27272a)',
            color: 'var(--text, #e4e4e7)',
            border: '1px solid var(--border, #3f3f46)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            transition: 'bottom 0.3s ease',
            fontSize: '20px'
        });

        document.getElementById('reader-container').appendChild(btn);
        window.foliateToggleBtn = btn;

        // Sync initial state on load
        const taskbar = document.getElementById('bottom-taskbar');
        if (taskbar && taskbar.classList.contains('hidden')) {
            btn.style.bottom = '20px';
            btn.innerHTML = '<i class="ph ph-caret-up"></i>';
        }

        // Button Click Logic
        btn.onclick = () => {
            if (taskbar) {
                taskbar.classList.toggle('hidden');
                
                // Animate button moving up and down with the taskbar
                if (taskbar.classList.contains('hidden')) {
                    btn.style.bottom = '20px'; // Drop down
                    btn.innerHTML = '<i class="ph ph-caret-up"></i>'; // Point up to reveal
                } else {
                    btn.style.bottom = '80px'; // Rise up
                    btn.innerHTML = '<i class="ph ph-caret-down"></i>'; // Point down to hide
                }
            }
        };

        window.updateSettings();
        const savedLocation = localStorage.getItem('bookmark-' + bookId);
        if (savedLocation) {
            setTimeout(() => window.foliateView.goTo(savedLocation), 50);
        }

    } catch (error) {
        console.error("Foliate Engine Error:", error);
        alert("Foliate encountered an error. Reverting to EPUB.js.");
        document.getElementById('set-reader-engine').value = 'epubjs';
        if (typeof window.changeReaderEngine === 'function') window.changeReaderEngine();
    }
};

window.destroyFoliateEngine = function() {
    if (window.foliateView) {
        window.foliateView.remove();
        window.foliateView = null;
        window.foliateCurrentCfi = null;
        window.rendition = null; 
    }
    // Clean up the floating button when leaving Foliate mode
    if (window.foliateToggleBtn) {
        window.foliateToggleBtn.remove();
        window.foliateToggleBtn = null;
    }
};
