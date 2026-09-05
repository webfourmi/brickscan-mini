const CACHE = "brickscan-mini-v1.3.1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=131",
  "data.js?v=131",
  "app.js?v=131",
  "manifest.webmanifest?v=131",
  "icons/icon-192.png",
  "icons/icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, {cache:"no-store"})
      .then(response => {
        if (response && response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./")))
  );
});
