const CACHE = "tracy-v5.4";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/main.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/navigation.js",
  "./js/ui.js",
  "./js/attendance.js",
  "./js/excel.js",
  "./js/timetable.js",
  "./js/prediction.js",
  "./js/calculator.js",
  "./js/analytics.js",
  "./js/calendar.js",
  "./js/campus.js",
  "./js/guide.js",
  "./js/ads.js",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/pages.css",
  "./css/animations.css",
  "./css/themes.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(ASSETS);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Timetable files: Network First, then Cache
  if (url.pathname.includes("/timetable/") && url.pathname.endsWith(".xlsx")) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache external or internal resources if successful
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.status === 0)
        ) {
          const copy = networkResponse.clone();
          caches.open(CACHE).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return networkResponse;
      });
    }),
  );
});
