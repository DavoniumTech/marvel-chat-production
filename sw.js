const CACHE = "marvel-chat-shell-20261007-3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/api.js",
  "./js/config.js",
  "./js/firebase.js",
  "./js/icons.js",
  "./js/media.js",
  "./js/state.js",
  "./js/ui.js",
  "./assets/brand/icon-192.png",
  "./assets/brand/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

function isStatic(request) {
  if (request.method !== "GET") return false;
  if (new URL(request.url).origin !== self.location.origin) return false;
  return /\.(?:css|js|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(new URL(request.url).pathname) || new URL(request.url).pathname.endsWith("manifest.json");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.destination === "document") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  if (isStatic(request)) {
    event.respondWith(caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
  }
});
