const CACHE = "tracy-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["./", "./index.html", "./main.js", "./manifest.json"]),
      ),
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

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const copy = networkResponse.clone();

        caches.open(CACHE).then((cache) => {
          cache.put(event.request, copy);
        });

        return networkResponse;
      })
      .catch(() => caches.match(event.request)),
  );
});
