/* /sw.js */
const VERSION = "ep-v1";
const RUNTIME_CACHE = `${VERSION}-runtime`;

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k.startsWith("ep-") && !k.startsWith(VERSION)) ? caches.delete(k) : null)
    );
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || (await networkPromise) || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // only cache GET
  if (req.method !== "GET") return;

  // never interfere with uploads
  if (url.pathname.includes("/api/guestbook/") && url.pathname.includes("/upload")) return;
  if (url.pathname.includes("/api/guestbook/") && url.pathname.includes("/submit")) return;

  // avoid caching range requests (video seeking/streaming)
  if (req.headers.has("range")) return;

  // static assets => cache-first
  const isStatic =
    url.pathname.startsWith("/_next/") ||
    /\.(js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // template + public event lookups => SWR
  const isTemplateOrPublic =
    url.pathname.includes("/templates/") ||
    url.pathname.includes("/public/event/");

  if (isTemplateOrPublic) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
});
