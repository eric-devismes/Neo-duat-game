// Home_Made — service worker.
// Strategy:
//   - Cache the app shell on install.
//   - Network-first for navigations and API; fall back to cache when offline.
//   - 'sync' event drains the offline-scan queue (movements queued in IndexedDB).

const CACHE = "home-made-shell-v1";
const SHELL = ["/", "/scan", "/inventory", "/movements", "/labels", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations + api
  if (req.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)),
  );
});

// Background sync: when the OS decides we're back online, ping the page
// so it drains the queue.
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-queue") {
    event.waitUntil(notifyClients("flush-queue"));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

async function notifyClients(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}
