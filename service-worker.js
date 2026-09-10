const CACHE = "brickscan-mini-v2.8.4";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=284",
  "v14.css?v=284",
  "v19.css?v=284",
  "v20.css?v=284",
  "data.js?v=284",
  "archive-data.js?v=284",
  "archive-images.js?v=284",
  "special-data.js?v=284",
  "special-images.js?v=284",
  "shrek-data.js?v=284",
  "catalog-loader.js?v=284",
  "catalog.json",
  "app.js?v=284",
  "v14.js?v=284",
  "backup.js?v=284",
  "v19.js?v=284",
  "v20.js?v=284",
  "v21.js?v=284",
  "v22.js?v=284",
  "v24.js?v=284",
  "scanner-v282.js?v=284",
  "v28.js?v=284",
  "version.json",
  "manifest.webmanifest?v=284",
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