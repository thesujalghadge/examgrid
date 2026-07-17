const CACHE_NAME = 'examgrid-cache-v2';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/globals.css'
];

// Paths to explicitly exclude from caching (like the CBT interface)
const EXCLUDE_PATHS = [
  '/student/tests/',
  '/api/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude CBT testing interface, Next API routes, and external Supabase API from cache
  const isExternalAPI = url.origin !== location.origin;
  if (isExternalAPI || EXCLUDE_PATHS.some(path => url.pathname.includes(path)) || event.request.method !== 'GET') {
    return; // Fall back to default browser behavior (Network Only)
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache successful GET responses for next time
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return cached if network fails
        return cachedResponse;
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
