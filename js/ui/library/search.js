// --- SEARCH FUNCTIONALITY ---

export function toggleUniversalSearch() {
    const isEditor = document.getElementById('editor-view').classList.contains('active');
    const containerId = isEditor ? 'editor-search-container' : 'library-search-container';
    const inputId = isEditor ? 'editor-search-input' : 'library-search-input';
    
    const container = document.getElementById(containerId);
    if (container.style.display === 'none') {
        container.style.display = 'block';
        document.getElementById(inputId).focus();
    } else {
        container.style.display = 'none';
        document.getElementById(inputId).value = '';
        
        // Import state dynamically to avoid circular dependency
        const { state } = window.libraryModules || {};
        if (state) {
            state.librarySearchQuery = '';
        }
        
        if (isEditor) {
            if (typeof window.loadEditorBookList === 'function') window.loadEditorBookList(1);
        } else {
            if (typeof window.loadLibrary === 'function') window.loadLibrary(1);
        }
    }
}

export function applyUniversalSearch() {
    const isEditor = document.getElementById('editor-view').classList.contains('active');
    const inputId = isEditor ? 'editor-search-input' : 'library-search-input';
    
    const { state } = window.libraryModules || {};
    if (state) {
        state.librarySearchQuery = document.getElementById(inputId).value.toLowerCase();
    }
    
    if (isEditor) {
        if (typeof window.loadEditorBookList === 'function') window.loadEditorBookList(1);
    } else {
        if (typeof window.loadLibrary === 'function') window.loadLibrary(1);
    }
}
