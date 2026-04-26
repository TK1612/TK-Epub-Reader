// js/reader/foliate-engine.js
import 'https://cdn.jsdelivr.net/gh/johnfactotum/foliate-js@main/view.js';

window.foliateView = null;
window.foliateCurrentCfi = null;
window.taskbarToggleBtn = null;

window.launchFoliateEngine = async function(bookId) {
    try {
        const bookData = await localforage.getItem(bookId);
        if (!bookData) throw new Error("Could not retrieve book from database.");
        
        const actualBuffer = bookData.buffer || bookData; 
        if (!actualBuffer || actualBuffer.byteLength === 0) throw new Error("Book file is empty or corrupted.");

        const viewerContainer = document.getElementById('viewer');
        viewerContainer.innerHTML = ''; 

        await customElements.whenDefined('foliate-view');
        window.foliateView = document.createElement('foliate-view');
        window.foliateView.style.width = '100%';
        window.foliateView.style.height = '100%';
        window.foliateView.style.display = 'block';

        const readMode = document.getElementById('set-read-mode').value;
        const targetLayout = (readMode === 'continuous' || readMode === 'scrolled') ? 'scrolled' : 'paginated';
        window.foliateView.setAttribute('layout', targetLayout);
        
        viewerContainer.appendChild(window.foliateView);

        window.rendition = {
            next: () => { if (window.foliateView) window.foliateView.next(); },
            prev: () => { if (window.foliateView) window.foliateView.prev(); },
            display: (loc) => { if (window.foliateView) window.foliateView.goTo(loc); },
            currentLocation: () => { return { start: { cfi: window.foliateCurrentCfi } }; }
        };

        window.updateSettings = function() {
            if (!window.foliateView) return;
            const theme = document.getElementById('set-reader-theme').value;
            const fontSize = document.getElementById('set-font').value + 'px';
            const lineHeight = document.getElementById('set-line').value;
            const paraSpacing = document.getElementById('set-para-spacing').value + 'em';
            const indent = document.getElementById('set-indent').value + 'em';
            const fontFamily = document.getElementById('set-font-family').value;
            const textColor = document.getElementById('set-text-color').value;

            let bgColor = '#18181b'; let color = textColor;
            if (theme === 'light') { bgColor = '#ffffff'; color = textColor === '#e4e4e7' ? '#000000' : textColor; }
            else if (theme === 'paper') { bgColor = '#f4ecd8'; color = textColor === '#e4e4e7' ? '#333333' : textColor; }
            else if (theme === 'blue' || theme === 'light-blue') { bgColor = '#e8f4f8'; color = textColor === '#e4e4e7' ? '#1a365d' : textColor; }
            else if (theme === 'black') { bgColor = '#000000'; color = textColor; } 
            else if (theme === 'dark') { bgColor = '#18181b'; color = textColor; } 
            
            document.getElementById('reader-container').style.backgroundColor = bgColor;
            viewerContainer.style.backgroundColor = bgColor;

            const currentReadMode = document.getElementById('set-read-mode').value;
            const currentLayout = (currentReadMode === 'continuous' || currentReadMode === 'scrolled') ? 'scrolled' : 'paginated';
            if (window.foliateView.renderer) window.foliateView.renderer.setAttribute('flow', currentLayout);

            const cssString = `
                @namespace epub "http://www.idpf.org/2007/ops";
                html, body { 
                    background: ${bgColor} !important; 
                    color: ${color} !important; 
                    font-family: ${fontFamily} !important; 
                    font-size: ${fontSize} !important; 
                    line-height: ${lineHeight} !important; 
                    cursor: pointer !important;
                    -webkit-tap-highlight-color: transparent;
                }
                p { margin-bottom: ${paraSpacing} !important; text-indent: ${indent} !important; }
            `;
            if (window.foliateView.renderer && typeof window.foliateView.renderer.setStyles === 'function') {
                try { window.foliateView.renderer.setStyles(cssString); } catch(e) {}
            }

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

        window.foliateView.addEventListener('relocate', (e) => {
            const loc = e.detail;
            window.foliateCurrentCfi = loc.cfi;
            localStorage.setItem('bookmark-' + bookId, loc.cfi);
            
            let chapterName = "Reading...";
            let currentHref = loc.href || null;

            if (loc.tocItem) { if (loc.tocItem.label) chapterName = loc.tocItem.label; if (loc.tocItem.href) currentHref = loc.tocItem.href; }
            document.getElementById('chapter-title').innerText = chapterName;
            localStorage.setItem('progress-' + bookId, JSON.stringify({ chapter: chapterName, percentage: loc.fraction || 0 }));

            const targetPath = currentHref ? currentHref.split('#')[0].replace(/^\//, '') : null;
            document.querySelectorAll('#toc-list .list-item').forEach(li => {
                const itemPath = li.dataset.href ? li.dataset.href.split('#')[0].replace(/^\//, '') : null;
                if (itemPath && targetPath && itemPath === targetPath) {
                    li.style.color = 'var(--accent)'; li.style.fontWeight = 'bold'; li.style.borderLeft = '3px solid var(--accent)'; 
                    li.style.paddingLeft = '25px'; 
                    li.id = "active-toc-item"; 
                } else {
                    li.style.color = ''; li.style.fontWeight = 'normal'; li.style.borderLeft = 'none'; 
                    li.style.paddingLeft = '15px'; 
                    if (li.id === "active-toc-item") li.removeAttribute('id');
                }
            });
        });

        window.foliateView.addEventListener('click', (e) => {
            const detail = e.detail || {};
            const target = detail.target || e.target;
            if (target && target.tagName && target.tagName.toLowerCase() === 'a') return;

            const taskbar = document.getElementById('bottom-taskbar');
            const pinCheckbox = document.getElementById('set-pin-taskbar');
            if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) taskbar.classList.toggle('hidden');
        });

        window.foliateView.addEventListener('load', (e) => {
            const innerDoc = e.detail.doc;
            if (!innerDoc) return;

            let touchStartX = 0; let touchStartY = 0; let touchStartTime = 0;

            innerDoc.addEventListener('touchstart', (ev) => {
                touchStartX = ev.changedTouches[0].screenX;
                touchStartY = ev.changedTouches[0].screenY;
                touchStartTime = Date.now();
            }, { passive: true });

            innerDoc.addEventListener('touchend', (ev) => {
                const endX = ev.changedTouches[0].screenX;
                const endY = ev.changedTouches[0].screenY;
                const timeTaken = Date.now() - touchStartTime;
                const dx = Math.abs(endX - touchStartX);
                const dy = Math.abs(endY - touchStartY);

                if (timeTaken < 300 && dx < 10 && dy < 10) {
                    if (ev.target && ev.target.closest && ev.target.closest('a')) return;
                    try { if (innerDoc.defaultView.getSelection().toString().length > 0) return; } catch(err) {}

                    const taskbar = document.getElementById('bottom-taskbar');
                    const pinCheckbox = document.getElementById('set-pin-taskbar');
                    if (taskbar && (!pinCheckbox || !pinCheckbox.checked)) {
                        taskbar.classList.toggle('hidden');
                        ev.stopPropagation(); 
                    }
                }
            }, { passive: true });
        });

        if (document.getElementById('taskbar-toggle-btn')) document.getElementById('taskbar-toggle-btn').remove();

        const btn = document.createElement('button');
        btn.id = 'taskbar-toggle-btn';
        btn.innerHTML = '<i class="ph ph-caret-down"></i>';
        
        Object.assign(btn.style, {
            position: 'fixed', bottom: '75px', right: '20px', zIndex: '9999', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border, #3f3f46)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)', transition: 'bottom 0.3s ease, background-color 0.2s ease', fontSize: '20px'
        });

        document.getElementById('reader-container').appendChild(btn);
        window.taskbarToggleBtn = btn;

        const taskbar = document.getElementById('bottom-taskbar');
        
        if (window.taskbarObserver) window.taskbarObserver.disconnect();
        window.taskbarObserver = new MutationObserver(() => {
            if (taskbar.classList.contains('hidden')) { btn.style.bottom = '20px'; btn.innerHTML = '<i class="ph ph-caret-up"></i>'; }
            else { btn.style.bottom = '75px'; btn.innerHTML = '<i class="ph ph-caret-down"></i>'; }
        });
        if (taskbar) {
            window.taskbarObserver.observe(taskbar, { attributes: true, attributeFilter: ['class'] });
            if (taskbar.classList.contains('hidden')) { btn.style.bottom = '20px'; btn.innerHTML = '<i class="ph ph-caret-up"></i>'; }
        }

        btn.onclick = (e) => { e.stopPropagation(); if (taskbar) taskbar.classList.toggle('hidden'); };

        window.updateSettings();
        
        // --- NEW: THE BULLETPROOF FALLBACK SEQUENCE ---
        const savedLocation = localStorage.getItem('bookmark-' + bookId);
        
        setTimeout(async () => {
            try {
                if (savedLocation && typeof savedLocation === 'string' && savedLocation.length > 0) {
                    await window.foliateView.goTo(savedLocation);
                } else {
                    // Kickstart for fresh custom books that stall on white screen
                    if (window.foliateView.book && window.foliateView.book.toc && window.foliateView.book.toc.length > 0) {
                        await window.foliateView.goTo(window.foliateView.book.toc[0].href);
                    }
                }
            } catch (err) {
                console.warn("Foliate Navigation Error. Wiping bookmark and falling back to start.", err);
                localStorage.removeItem('bookmark-' + bookId);
                
                // Fallback: Force jump to the very first chapter in the TOC
                try {
                    if (window.foliateView.book && window.foliateView.book.toc && window.foliateView.book.toc.length > 0) {
                        await window.foliateView.goTo(window.foliateView.book.toc[0].href);
                    }
                } catch (fallbackErr) {}
            }
        }, 150); // Small buffer to ensure Foliate's DOM is completely initialized before jumping

    } catch (error) {
        console.error("Foliate Engine Error:", error);
        throw error; 
    }
};

window.destroyFoliateEngine = function() {
    if (window.foliateView) { window.foliateView.remove(); window.foliateView = null; window.foliateCurrentCfi = null; window.rendition = null; }
    if (window.taskbarToggleBtn) { window.taskbarToggleBtn.remove(); window.taskbarToggleBtn = null; }
    if (window.taskbarObserver) { window.taskbarObserver.disconnect(); }
};
