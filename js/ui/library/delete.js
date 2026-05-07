// --- DELETE OPERATIONS ---

import { state } from './state.js';
import { loadLibrary } from './renderer.js';
import { toggleBookSelection, updateBatchDeleteCount } from './selection.js';

export async function deleteBook(bookId, bookTitle) {
    if(confirm(`Are you sure you want to permanently delete "${bookTitle}"?`)) {
        await localforage.removeItem(bookId);
        localStorage.removeItem('bookmark-' + bookId);
        localStorage.removeItem('progress-' + bookId);
        localStorage.removeItem('locations-' + bookId); 
        loadLibrary(state.currentLibraryPage); 
    }
}

export function toggleDeleteMode() {
    state.isDeleteMode = !state.isDeleteMode;
    const grid = document.getElementById('library-grid');
    const btn = document.getElementById('delete-mode-btn');
    const batchBar = document.getElementById('batch-delete-bar');
    
    if (state.isDeleteMode) {
        grid.classList.add('delete-mode');
        btn.classList.add('delete-btn-active');
        state.resetDeletionState(); // Reset on start
        if (batchBar) batchBar.classList.remove('hidden');
        updateBatchDeleteCount();
    } else {
        grid.classList.remove('delete-mode');
        btn.classList.remove('delete-btn-active');
        state.clearDeletionState();
        if (batchBar) batchBar.classList.add('hidden');
        document.querySelectorAll('.book-card.selected-for-delete').forEach(c => c.classList.remove('selected-for-delete'));
    }
}

export function selectAllForDeletion() {
    const allCards = document.querySelectorAll('#library-grid .book-card');
    if (allCards.length === 0) return;

    // Check if ALL currently visible books are selected
    const allSelected = Array.from(allCards).every(card => card.classList.contains('selected-for-delete'));

    if (allSelected) {
        // Deselect all on this page
        allCards.forEach(card => {
            const bookId = card.getAttribute('data-id');
            state.selectedForDeletion.delete(bookId);
            card.classList.remove('selected-for-delete');
        });
    } else {
        // Select all on this page
        allCards.forEach(card => {
            const bookId = card.getAttribute('data-id');
            state.selectedForDeletion.add(bookId);
            card.classList.add('selected-for-delete');
        });
    }
    updateBatchDeleteCount();
}

export async function executeBatchDelete() {
    if (state.selectedForDeletion.size === 0) return alert("Select at least one book to delete.");
    
    if (confirm(`Are you sure you want to permanently delete ${state.selectedForDeletion.size} book(s)?`)) {
        const btn = document.getElementById('batch-delete-btn');
        if (btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
        
        for (let bookId of state.selectedForDeletion) {
            await localforage.removeItem(bookId);
            localStorage.removeItem('bookmark-' + bookId);
            localStorage.removeItem('progress-' + bookId);
            localStorage.removeItem('locations-' + bookId);
        }
        
        state.clearDeletionState();
        toggleDeleteMode();
        loadLibrary(state.currentLibraryPage);
        if (btn) btn.innerHTML = 'Delete';
    }
}
