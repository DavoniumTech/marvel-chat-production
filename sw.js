const CACHE = "marvel-chat-shell-20261008-1";
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
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isStatic(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return /\.(?:css|js|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname) || url.pathname.endsWith("manifest.json");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.destination === "document") {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isStatic(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Firebase Cloud Messaging background notifications.
try {
  importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

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
    const notification = payload?.notification || {};
    const title = notification.title || "Marvel Chat";
    const options = {
      body: notification.body || "You have a new update.",
      icon: "./assets/brand/icon-192.png",
      badge: "./assets/brand/icon-192.png",
      data: payload?.data || {},
      tag: payload?.data?.tag || "marvel-chat"
    };
    self.registration.showNotification(title, options);
  });
} catch (error) {
  // The application remains functional when background FCM is unavailable.
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "./";
  event.waitUntil(
    clients.matchAll({type: "window", includeUncontrolled: true}).then((clientList) => {
      const existing = clientList.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
