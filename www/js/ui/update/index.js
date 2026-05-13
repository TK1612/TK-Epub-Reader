let newWorker;

export async function initUpdater() {
    // 1. Check for GitHub updates first (for APK/PWA)
    await checkForGitHubUpdates();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            
            // Listen for new updates downloading in the background
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                
                newWorker.addEventListener('statechange', () => {
                    // If the new worker is installed and waiting for permission...
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateModal();
                    }
                });
            });
        }).catch(err => {
            console.error('Service Worker registration failed:', err);
        });

        // When the Service Worker successfully swaps to the new version, reload the page
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }
}

async function checkForGitHubUpdates() {
    // Replace these with your actual GitHub details
    const REPO_OWNER = 'YourGitHubUsername';
    const REPO_NAME = 'TK-Epub-Reader-main';
    const VERSION_FILE = 'version.json'; // Create a small JSON file in your repo: {"version": "1.2.4"}

    try {
        const response = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${VERSION_FILE}`);
        if (!response.ok) return;
        
        const data = await response.json();
        const currentVersion = '1.2.3'; // This should match your sw.js CACHE_NAME version

        if (data.version !== currentVersion) {
            showUpdate(`A new version (${data.version}) is available on GitHub!`);
        }
    } catch (e) {
        console.log('GitHub update check failed', e);
    }
}

function showUpdate(message = "A new version of TK Reader is ready.") {
    if (document.getElementById('update-modal')) return;

    const modalHTML = `
        <div id="update-modal" style="position: fixed; bottom: 20px; right: 20px; background: rgba(24, 24, 27, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; z-index: 9999; color: white; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); font-family: 'Inter', sans-serif;">
            <p style="margin: 0; font-weight: 600; font-size: 16px;">✨ Update Available!</p>
            <p style="margin: 0; font-size: 13px; color: var(--text-muted, #a1a1aa);">${message}</p>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button id="btn-update-now" style="background: var(--accent, #3b82f6); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Yes, Update</button>
                <button id="btn-update-later" style="background: transparent; color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;">No, Later</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-update-now').addEventListener('click', () => {
        if (newWorker) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
        } else {
            // If it's a GitHub update and not a SW update, force reload to fetch new assets
            window.location.reload(true);
        }
    });

    document.getElementById('btn-update-later').addEventListener('click', () => {
        document.getElementById('update-modal').remove();
    });
}