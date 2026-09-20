const CACHE = "brickscan-mini-v2.12.1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=2121",
  "v14.css?v=2121",
  "v19.css?v=2121",
  "v20.css?v=2121",
  "data.js?v=2121",
  "archive-data.js?v=2121",
  "archive-images.js?v=2121",
  "special-data.js?v=2121",
  "special-images.js?v=2121",
  "shrek-data.js?v=2121",
  "catalog-loader.js?v=2121",
  "catalog.json",
  "app.js?v=2121",
  "v14.js?v=2121",
  "backup.js?v=2121",
  "v19.js?v=2121",
  "v20.js?v=2121",
  "v21.js?v=2121",
  "v22.js?v=2121",
  "v24.js?v=2121",
  "v285.js?v=2121",
  "v29.js?v=2121",
  "v210.js?v=2121",
  "v2112.js?v=2121",
  "scanner-v282.js?v=2121",
  "v28.js?v=2121",
  "version.json",
  "manifest.webmanifest?v=2121",
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
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("version.json") || url.pathname.endsWith("/catalog.json") || url.pathname.endsWith("catalog.json")) {
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