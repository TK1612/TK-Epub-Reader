// --- BOOKMARKS FUNCTIONALITY ---

import { state } from './state.js';

export async function loadBookmarksList() {
    if (state.isBookmarksLoading) return;
    state.isBookmarksLoading = true;
    
    try {
        const list = document.getElementById('bookmarks-list');
        if(!list) return;
        
        const items = [];
        
        await localforage.iterate(function(value, key) {
            const savedCfi = localStorage.getItem('bookmark-' + key);
            if (savedCfi) {
                let progressText = "Auto-saved progress available";
                const progressData = localStorage.getItem('progress-' + key);
                if(progressData) {
                    try {
                        const parsed = JSON.parse(progressData);
                        progressText = parsed.chapter === value.title ? "Reading" : parsed.chapter;
                    } catch(e) {}
                }

                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <strong style="color:var(--accent); display:block; margin-bottom:4px;">${value.title}</strong>
                    <span style="font-size:12px; color:var(--text-muted);">${progressText}</span>
                `;
                li.onclick = () => {
                    if (typeof window.showView === 'function') window.showView('library');
                    if (typeof window.openReader === 'function') window.openReader(key);
                };
                items.push(li);
            }
        });

        list.innerHTML = '';
        items.forEach(li => list.appendChild(li));
        
        if (list.innerHTML === '') {
            list.innerHTML = '<p style="color:gray; padding:10px;">No reading progress saved yet.</p>';
        }
    } finally {
        state.isBookmarksLoading = false;
    }
}
