/* SonicStudio service worker.

   Strategy:
   - Page navigations are network-first, so an online visit always loads the
     latest deploy and the app can never get trapped on a stale version. When
     the network is unavailable, the last cached page is served instead.
   - Static assets (scripts, styles, icons, audio samples) are cached on first
     use and served cache-first, so the studio opens and runs offline after the
     first visit.

   There is no precache manifest or build step here, so nothing depends on the
   hashed asset filenames. Bump CACHE to retire everything from older versions. */

const CACHE = 'sonicstudio-cache-v1';

self.addEventListener('install', () => {
  // Safe to activate immediately: navigations stay network-first.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return; // cross-origin requests pass straight through to the network
  }

  // Page navigations: network-first, falling back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        const shell = await caches.match(self.registration.scope);
        return shell ?? Response.error();
      }
    })());
    return;
  }

  // Static assets: cache-first, then network (caching the result for next time).
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
