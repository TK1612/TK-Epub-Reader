// --- LIBRARY MODULE ENTRY POINT ---
// This file serves as the main entry point for the library UI module.
// It imports all sub-modules and attaches functions to window to maintain backward compatibility.

import { state, librarySortOrder, librarySearchQuery } from './state.js';
import { toggleUniversalSearch, applyUniversalSearch } from './search.js';
import { openLibrarySettings, applyLibrarySort } from './settings.js';
import { handleUpload } from './upload.js';
import { loadLibrary } from './renderer.js';
import { loadBookmarksList } from './bookmarks.js';
import {
    deleteBook,
    toggleDeleteMode,
    selectAllForDeletion,
    executeBatchDelete
} from './delete.js';
import { toggleBookSelection, updateBatchDeleteCount } from './selection.js';
import { loadEditorBookList } from './editor-list.js';

// Attach state to window for backward compatibility
// Note: These are getters/setters that reference the internal state
Object.defineProperty(window, 'librarySortOrder', {
    get: () => state.librarySortOrder,
    set: (value) => { state.librarySortOrder = value; },
    configurable: true
});

Object.defineProperty(window, 'librarySearchQuery', {
    get: () => state.librarySearchQuery,
    set: (value) => { state.librarySearchQuery = value; },
    configurable: true
});

// Attach loading states to window
Object.defineProperty(window, 'isLibraryLoading', {
    get: () => state.isLibraryLoading,
    set: (value) => { state.isLibraryLoading = value; },
    configurable: true
});

Object.defineProperty(window, 'isBookmarksLoading', {
    get: () => state.isBookmarksLoading,
    set: (value) => { state.isBookmarksLoading = value; },
    configurable: true
});

Object.defineProperty(window, 'isEditorLoading', {
    get: () => state.isEditorLoading,
    set: (value) => { state.isEditorLoading = value; },
    configurable: true
});

// Attach pagination state to window
Object.defineProperty(window, 'currentLibraryPage', {
    get: () => state.currentLibraryPage,
    set: (value) => { state.currentLibraryPage = value; },
    configurable: true
});

Object.defineProperty(window, 'currentEditorPage', {
    get: () => state.currentEditorPage,
    set: (value) => { state.currentEditorPage = value; },
    configurable: true
});

// Attach delete mode state to window
Object.defineProperty(window, 'isDeleteMode', {
    get: () => state.isDeleteMode,
    set: (value) => { state.isDeleteMode = value; },
    configurable: true
});

Object.defineProperty(window, 'selectedForDeletion', {
    get: () => state.selectedForDeletion,
    configurable: true
});

// Attach all functions to window for backward compatibility
window.toggleUniversalSearch = toggleUniversalSearch;
window.applyUniversalSearch = applyUniversalSearch;
window.openLibrarySettings = openLibrarySettings;
window.applyLibrarySort = applyLibrarySort;
window.handleUpload = handleUpload;
window.loadLibrary = loadLibrary;
window.deleteBook = deleteBook;
window.loadBookmarksList = loadBookmarksList;
window.toggleDeleteMode = toggleDeleteMode;
window.toggleBookSelection = toggleBookSelection;
window.selectAllForDeletion = selectAllForDeletion;
window.executeBatchDelete = executeBatchDelete;
window.loadEditorBookList = loadEditorBookList;

// Define launchEditor for backward compatibility
// This ensures it's available even if workspace.js loads later
window.launchEditor = function(bookId) {
    if (typeof window.openEditorWorkspace === 'function') {
        // Get book data from localforage to pass title
        localforage.getItem(bookId).then(bookData => {
            const bookTitle = bookData ? bookData.title : "Unknown";
            window.openEditorWorkspace(bookId, bookTitle);
        }).catch(() => {
            window.openEditorWorkspace(bookId, "Unknown");
        });
    } else {
        console.error('openEditorWorkspace is not defined');
    }
};

// Export state for internal module use
window.libraryModules = { state };

// Also export for ES module imports
export {
    state,
    toggleUniversalSearch,
    applyUniversalSearch,
    openLibrarySettings,
    applyLibrarySort,
    handleUpload,
    loadLibrary,
    deleteBook,
    loadBookmarksList,
    toggleDeleteMode,
    toggleBookSelection,
    selectAllForDeletion,
    executeBatchDelete,
    loadEditorBookList
};

// Initialize the library view after the module loads
history.replaceState({ view: 'library' }, '', '#library');
if (typeof loadLibrary === 'function') {
    loadLibrary();
}
