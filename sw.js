// sw.js
const CACHE_NAME = 'tk-epub-reader-v1.2.3'; 
const CORE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './assets/site.webmanifest',
    './assets/web-app-manifest-192x192.png',
    './assets/web-app-manifest-512x512.png'
];

// 1. Install Event: Cache the core files, but DO NOT activate immediately.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS);
        })
    );
    // Notice we do NOT call self.skipWaiting() here. It waits for user permission!
});

// 2. Activate Event: Clean up old caches when a new update is finally applied.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event: Cache-First strategy with Dynamic Fallback Caching
self.addEventListener('fetch', (event) => {
    // Only intercept basic GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // If it's in the cache, return it immediately (Offline support!)
            if (cachedResponse) {
                return cachedResponse;
            }

            // If it's NOT in the cache, fetch it from the network...
            return fetch(event.request).then((networkResponse) => {
                // Ensure the response is valid before caching it
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // ...and dynamically add it to the cache for next time
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Optional: You could return a custom offline page here if the network fails
                console.warn('Network request failed and no cache available for:', event.request.url);
            });
        })
    );
});

// 4. Message Listener: This listens for the "Update Now" click from your Phase 3 UI.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting(); 
    }
});