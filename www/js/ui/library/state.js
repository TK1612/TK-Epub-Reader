// --- GLOBAL DISPLAY SETTINGS ---
// These are exported for use by other modules but attached to window in index.js

export let librarySortOrder = 'newest';
export let librarySearchQuery = '';

// Loading states
let isLibraryLoading = false;
let isBookmarksLoading = false;
let isEditorLoading = false;

// Pagination state
let currentLibraryPage = 1;
const BOOKS_PER_PAGE = 100;

let currentEditorPage = 1;
const EDITOR_BOOKS_PER_PAGE = 100;

// Delete mode state
let selectedForDeletion = new Set();
let isDeleteMode = false;

// Export getters and setters for encapsulated state
export const state = {
    // Library sort and search
    get librarySortOrder() { return librarySortOrder; },
    set librarySortOrder(value) { librarySortOrder = value; },
    get librarySearchQuery() { return librarySearchQuery; },
    set librarySearchQuery(value) { librarySearchQuery = value; },

    // Loading states
    get isLibraryLoading() { return isLibraryLoading; },
    set isLibraryLoading(value) { isLibraryLoading = value; },
    get isBookmarksLoading() { return isBookmarksLoading; },
    set isBookmarksLoading(value) { isBookmarksLoading = value; },
    get isEditorLoading() { return isEditorLoading; },
    set isEditorLoading(value) { isEditorLoading = value; },

    // Pagination
    get currentLibraryPage() { return currentLibraryPage; },
    set currentLibraryPage(value) { currentLibraryPage = value; },
    get BOOKS_PER_PAGE() { return BOOKS_PER_PAGE; },
    get currentEditorPage() { return currentEditorPage; },
    set currentEditorPage(value) { currentEditorPage = value; },
    get EDITOR_BOOKS_PER_PAGE() { return EDITOR_BOOKS_PER_PAGE; },

    // Delete mode
    get selectedForDeletion() { return selectedForDeletion; },
    get isDeleteMode() { return isDeleteMode; },
    set isDeleteMode(value) { isDeleteMode = value; },

    // Helper to reset deletion state
    resetDeletionState() {
        selectedForDeletion = new Set();
    },

    // Helper to clear deletion state
    clearDeletionState() {
        selectedForDeletion.clear();
    }
};
