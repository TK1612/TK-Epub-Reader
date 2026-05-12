// --- LIBRARY SETTINGS FUNCTIONALITY ---

export function openLibrarySettings() {
    const modal = document.getElementById('library-settings-modal');
    // Toggle: if modal is already active, close it
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        return;
    }
    // Close other modals first
    if (window.closeAllModals) window.closeAllModals();
    else document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    
    const { state } = window.libraryModules || {};
    if (state) {
        document.getElementById('library-sort-select').value = state.librarySortOrder;
    }
    
    modal.classList.add('active');
}

export function applyLibrarySort() {
    const { state } = window.libraryModules || {};
    if (state) {
        state.librarySortOrder = document.getElementById('library-sort-select').value;
    }
    
    const isEditor = document.getElementById('editor-view').classList.contains('active');
    
    if (isEditor) {
        if (typeof window.loadEditorBookList === 'function') window.loadEditorBookList(1);
    } else {
        if (typeof window.loadLibrary === 'function') window.loadLibrary(1);
    }
}

// Double-click on modal background closes the modal
const librarySettingsModal = document.getElementById('library-settings-modal');
if (librarySettingsModal) {
    librarySettingsModal.addEventListener('dblclick', (e) => {
        // Only close if the double-click target is the modal background itself (not inner content)
        if (e.target === librarySettingsModal) {
            librarySettingsModal.classList.remove('active');
        }
    });
}
