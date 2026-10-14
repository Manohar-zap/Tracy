const CACHE_NAME = "tracy-v6.1.10"; // Secret Admin UI for holidays & remove target from quick calc

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
  "./js/admin.js",
  "./js/ads.js",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/pages.css",
  "./css/animations.css",
  "./css/themes.css",
  "./icons/icon.svg",
  "./guide/image_01.jpg",
  "./guide/image_02.jpg",
  "./guide/image_03.jpg",
  "./guide/image_04.jpg",
  "./guide/image_05.jpg",
  "./guide/image_06.jpg",
  "./guide/image_07.jpg",
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

  // Bypass cache for analytics and ad tracking
  if (
    url.hostname.includes("google-analytics.com") ||
    url.hostname.includes("googlesyndication.com")
  ) {
    return;
  }

  // 1. HTML: Network-First (Always check for latest version, fallback to cache)
  if (event.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname === "/") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match("./index.html") || caches.match("index.html"))),
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
