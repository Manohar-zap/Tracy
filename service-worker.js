const CACHE_NAME = "tracy-v5.9.0"; // Bump version to clear old Cache-First entries

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
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
    }).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. HTML: Network-First (Always check for latest version, fallback to cache)
  if (event.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname === "/") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // 2. Timetables & Data: Network-First
  if (url.pathname.includes("/timetable/") || url.search.includes("action=")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // 3. App Assets (JS/CSS) & External Resources: Stale-While-Revalidate
  // Fast from cache, update in background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200 || networkResponse.status === 0) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });

      return cachedResponse || networkFetch;
    }),
  );
});
