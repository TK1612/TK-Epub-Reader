/**
 * Editor Modal Helper Module
 * Handles modal open/close operations for the editor
 * Reduces code duplication across editor functions
 */

/**
 * Open an editor modal
 * @param {string} modalId - The ID of the modal to open
 */
window.openEditorModal = function(modalId) {
    // Close all modals first
    if (typeof window.closeAllModals === 'function') {
        window.closeAllModals();
    } else {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }
    
    // Open the specified modal
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
};

/**
 * Close an editor modal
 * @param {string} modalId - The ID of the modal to close (optional - closes all if not specified)
 */
window.closeEditorModal = function(modalId) {
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    } else {
        if (typeof window.closeAllModals === 'function') {
            window.closeAllModals();
        } else {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        }
    }
};

/**
 * Close all modals and open a specific one (convenience function)
 * @param {string} modalId - The ID of the modal to open
 */
window.closeAllAndOpenModal = function(modalId) {
    window.openEditorModal(modalId);
};
