
importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  projectId: "project-ec531e09-e3fd-4408-a35",
  appId: "1:960686800050:web:f3c7abb87660d9d2e0ddab",
  storageBucket: "project-ec531e09-e3fd-4408-a35.firebasestorage.app",
  apiKey: "AIzaSyC-vHsXH07CwpxoRZ-rE7SU3sHc9A6sYl8",
  authDomain: "project-ec531e09-e3fd-4408-a35.firebaseapp.com",
  messagingSenderId: "960686800050",
  measurementId: "G-SFD6SXHML0"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Marvel Chat";
  const body = payload?.notification?.body || payload?.data?.body || "You have a new notification.";
  const iconUrl = payload?.notification?.icon || "./assets/brand/icon-192.png";
  self.registration.showNotification(title, {
    body,
    icon: iconUrl,
    badge: "./assets/brand/icon-192.png",
    data: { url: payload?.data?.url || "./" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "./";
  event.waitUntil((async () => {
    const windows = await clients.matchAll({type: "window", includeUncontrolled: true});
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        try { await client.navigate(target); } catch {}
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
const CACHE="marvel-chat-shell-20261007-4";
const SHELL=["./","./index.html","./css/styles.css","./js/app.js","./js/api.js","./js/media.js","./js/config.js","./js/firebase.js","./js/icons.js","./js/state.js","./js/ui.js","./manifest.json","./robots.txt","./sitemap.xml","./assets/brand/icon-192.png","./assets/brand/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));});
