const CACHE = "brickscan-mini-v2.0.1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=200",
  "v14.css?v=200",
  "v19.css?v=200",
  "v20.css?v=200",
  "data.js?v=200",
  "archive-data.js?v=200",
  "archive-images.js?v=200",
  "shrek-data.js?v=200",
  "app.js?v=200",
  "v14.js?v=200",
  "backup.js?v=200",
  "v19.js?v=200",
  "v20.js?v=200",
  "version.json",
  "manifest.webmanifest?v=200",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("version.json")) {
    event.respondWith(fetch(event.request, {cache:"no-store"}));
    return;
  }
  event.respondWith(fetch(event.request, {cache:"no-store"}).then(response => {
    if (response && response.ok && url.origin === location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./"))));
});
