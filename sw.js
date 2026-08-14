const CACHE_PREFIX = 'mode-atlas';

// Retirement-only Service Worker. Existing legacy registrations may discover
// this file through the browser's own Service Worker update lifecycle. It never
// intercepts fetch/navigation and unregisters itself as soon as it activates.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => String(key || '').toLowerCase().startsWith(CACHE_PREFIX))
          .map(key => caches.delete(key))
      );
    } catch (error) {}

    try {
      await self.registration.unregister();
    } catch (error) {}
  })());
});
