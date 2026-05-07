// Global State Variables
window.book = null;
window.rendition = null;
window.currentBookId = null;
window.isDeleteMode = false;

// Initialize IndexedDB for storing EPUBs
localforage.config({ 
    name: 'WebNovelReader', 
    storeName: 'epubs' 
});
