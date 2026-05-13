// --- SELECTION HELPERS (shared between renderer and delete modules) ---

import { state } from './state.js';

export function toggleBookSelection(bookId, cardElement) {
    if (state.selectedForDeletion.has(bookId)) {
        state.selectedForDeletion.delete(bookId);
        cardElement.classList.remove('selected-for-delete');
    } else {
        state.selectedForDeletion.add(bookId);
        cardElement.classList.add('selected-for-delete');
    }
    updateBatchDeleteCount();
}

export function updateBatchDeleteCount() {
    const countSpan = document.getElementById('batch-delete-count');
    if (countSpan) countSpan.innerText = `${state.selectedForDeletion.size} Selected`;
}
