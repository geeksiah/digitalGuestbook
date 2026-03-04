self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith('ep-') || key.startsWith('workbox-') || key.includes('_next'))
            .map((key) => caches.delete(key))
        );
      } catch (error) {
        console.warn('SW cleanup failed:', error);
      }

      await self.clients.claim();
      await self.registration.unregister();

      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      clients.forEach((client) => {
        client.navigate(client.url);
      });
    })()
  );
});
