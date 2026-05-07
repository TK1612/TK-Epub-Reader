// --- LIBRARY RENDERING ---

import { state } from './state.js';
import { toggleBookSelection, updateBatchDeleteCount } from './selection.js';

const NO_COVER_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';

export async function loadLibrary(page = 1) {
    if (state.isLibraryLoading) return; 
    state.isLibraryLoading = true;
    state.currentLibraryPage = page;
    
    try {
        const grid = document.getElementById('library-grid');
        const paginationContainer = document.getElementById('library-pagination');
        if (!grid) return;
        
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 32px; color: var(--accent);"></i><p style="color: var(--text-muted); margin-top: 10px;">Loading library...</p></div>';
        
        let catalog = [];
        
        await localforage.iterate(function(value, key) {
            if (!key.startsWith('bookmark-') && !key.startsWith('progress-') && !key.startsWith('locations-')) {
                catalog.push({ key: key, title: value.title || "Unknown" });
            }
        });
        
        catalog.reverse(); 

        if (state.librarySearchQuery) {
            catalog = catalog.filter(item => item.title.toLowerCase().includes(state.librarySearchQuery));
        }

        if (state.librarySortOrder === 'az') {
            catalog.sort((a, b) => a.title.localeCompare(b.title));
        } else if (state.librarySortOrder === 'za') {
            catalog.sort((a, b) => b.title.localeCompare(a.title));
        }

        const totalPages = Math.ceil(catalog.length / state.BOOKS_PER_PAGE) || 1;
        if (state.currentLibraryPage > totalPages) state.currentLibraryPage = totalPages;

        const startIndex = (state.currentLibraryPage - 1) * state.BOOKS_PER_PAGE;
        const pageItems = catalog.slice(startIndex, startIndex + state.BOOKS_PER_PAGE);

        const cards = []; 
        
        for (let item of pageItems) {
            const value = await localforage.getItem(item.key);
            if (!value) continue;

            const coverImg = value.cover ? value.cover : NO_COVER_SVG;
            
            let progressText = "Not Started";
            const progressData = localStorage.getItem('progress-' + item.key);
            if (progressData) {
                try {
                    const parsed = JSON.parse(progressData);
                    progressText = parsed.chapter || "Reading...";
                    if (progressText === value.title) progressText = "Reading...";
                } catch(e) {}
            }

            const card = document.createElement('div');
            card.className = 'book-card';
            card.setAttribute('data-id', item.key);

            // Re-apply selection state if moving between pages while deleting
            if (state.isDeleteMode && state.selectedForDeletion.has(item.key)) {
                card.classList.add('selected-for-delete');
            }

            card.innerHTML = `
                <div class="delete-overlay">
                    <i class="ph ph-trash"></i>
                    <span>Click to Delete</span>
                </div>
                <img src="${coverImg}" class="book-cover">
                <div class="book-info">
                    <div class="book-title" title="${value.title}">${value.title}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${progressText}">
                        ${progressText}
                    </div>
                </div>
            `;

            card.onclick = () => {
                if (state.isDeleteMode) toggleBookSelection(item.key, card);
                else if (typeof window.openReader === 'function') window.openReader(item.key);
            };
            cards.push(card);
        }
        
        grid.innerHTML = '';
        cards.forEach(card => grid.appendChild(card));
        
        // Re-apply visual delete mode state to grid if moving pages
        if (state.isDeleteMode) grid.classList.add('delete-mode');
        else grid.classList.remove('delete-mode');

        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    const btn = document.createElement('button');
                    btn.className = `page-btn ${i === state.currentLibraryPage ? 'active' : ''}`;
                    btn.innerText = i;
                    btn.onclick = () => loadLibrary(i);
                    paginationContainer.appendChild(btn);
                }
            }
        }
        
    } finally {
        state.isLibraryLoading = false; 
    }
}
