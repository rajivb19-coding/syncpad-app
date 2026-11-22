const CACHE_NAME = "syncpad-cache-v4";
const CORE_ASSETS = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW install precache warning:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("syncpad-cache-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function shouldBypassCache(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebasedatabase.app") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return true;
  }
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (shouldBypassCache(request)) return;

  // Network-first for HTML navigations so new deployments are picked up promptly
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached || caches.match("./")))
    );
    return;
  }

  // Same-origin static assets: cache-first, fallback to network
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});