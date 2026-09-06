const CACHE = "brickscan-mini-v2.6.2";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=262",
  "v14.css?v=262",
  "v19.css?v=262",
  "v20.css?v=262",
  "data.js?v=262",
  "archive-data.js?v=262",
  "archive-images.js?v=262",
  "special-data.js?v=262",
  "special-images.js?v=262",
  "shrek-data.js?v=262",
  "app.js?v=262",
  "v14.js?v=262",
  "backup.js?v=262",
  "v19.js?v=262",
  "v20.js?v=262",
  "v21.js?v=262",
  "v22.js?v=262",
  "v24.js?v=262",
  "version.json",
  "manifest.webmanifest?v=262",
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
