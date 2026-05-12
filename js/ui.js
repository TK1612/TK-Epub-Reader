// --- BROWSER BACK/FORWARD BUTTON LISTENER ---
window.addEventListener('popstate', function(event) {
    const state = event.state;
    if (state) {
        if (state.view === 'reader' && state.bookId) {
            window.openReader(state.bookId, false); 
        } else {
            window.closeReader(false); 
            window.showView(state.view, false);
        }
    }
});

// --- UI LOGIC ---
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.showView = function(viewId, pushHistory = true) {
    if (pushHistory) {
        history.pushState({ view: viewId }, '', '#' + viewId);
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    document.getElementById('page-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('collapsed');
    }
    
    if(viewId === 'library') window.loadLibrary();
    if(viewId === 'bookmarks') window.loadBookmarksList();
};

window.toggleDarkMode = function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    if(window.rendition) {
        window.rendition.themes.select(newTheme);
    }
};

window.closeAllModals = function() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
};
