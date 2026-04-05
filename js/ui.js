window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    document.getElementById('page-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    
    // Auto-close sidebar on mobile/small screens
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('collapsed');
    }
    
    if(viewId === 'library') window.loadLibrary();
    if(viewId === 'bookmarks') window.loadBookmarksList();
};

window.toggleDarkMode = function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if(window.rendition) window.rendition.themes.select(isDark ? "light" : "dark");
};

window.closeAllModals = function() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
};

window.toggleDeleteMode = function() {
    window.isDeleteMode = !window.isDeleteMode;
    const grid = document.getElementById('library-grid');
    const btn = document.getElementById('delete-mode-btn');
    
    if (window.isDeleteMode) {
        grid.classList.add('delete-mode');
        btn.classList.add('delete-btn-active');
    } else {
        grid.classList.remove('delete-mode');
        btn.classList.remove('delete-btn-active');
    }
};
