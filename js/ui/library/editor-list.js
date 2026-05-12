// --- EDITOR BOOK LIST ---

import { state } from './state.js';

const NO_COVER_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDJkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWNhY2FjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gQ292ZXI8L3RleHQ+PC9zdmc+';

export async function loadEditorBookList(page = 1) {
    if (state.isEditorLoading) return;
    state.isEditorLoading = true;
    state.currentEditorPage = page;
    
    try {
        const grid = document.getElementById('editor-book-list');
        const paginationContainer = document.getElementById('editor-pagination');
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
        
        const totalPages = Math.ceil(catalog.length / state.EDITOR_BOOKS_PER_PAGE) || 1;
        if (state.currentEditorPage > totalPages) state.currentEditorPage = totalPages;
        
        const startIndex = (state.currentEditorPage - 1) * state.EDITOR_BOOKS_PER_PAGE;
        const pageItems = catalog.slice(startIndex, startIndex + state.EDITOR_BOOKS_PER_PAGE);
        
        const cards = [];
        
        for (let item of pageItems) {
            const value = await localforage.getItem(item.key);
            if (!value) continue;
            
            const coverImg = value.cover ? value.cover : NO_COVER_SVG;
            
            const card = document.createElement('div');
            card.className = 'book-card';
            card.setAttribute('data-id', item.key);
            
            card.innerHTML = `
                <img src="${coverImg}" class="book-cover">
                <div class="book-info">
                    <div class="book-title" title="${value.title}">${value.title}</div>
                </div>
            `;
            
            card.onclick = () => {
                window.activeBookIdForEditor = item.key;
                if (typeof window.launchEditor === 'function') {
                    window.launchEditor(item.key);
                } else {
                    console.error('launchEditor is not defined');
                }
            };
            cards.push(card);
        }
        
        grid.innerHTML = '';
        cards.forEach(card => grid.appendChild(card));
        
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    const btn = document.createElement('button');
                    btn.className = `page-btn ${i === state.currentEditorPage ? 'active' : ''}`;
                    btn.innerText = i;
                    btn.onclick = () => loadEditorBookList(i);
                    paginationContainer.appendChild(btn);
                }
            }
        }
        
    } finally {
        state.isEditorLoading = false;
    }
}
