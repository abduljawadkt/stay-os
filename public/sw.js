// StayOS service worker: makes the web app installable and quick to open.
// - App pages: network first, the last copy when offline (so the installed app always opens).
// - Built files under /_next/static: cached forever (their names change on every deploy).
// - Database and sign-in requests (other origins) are never cached.
const VERSION = "stayos-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const SHELL = ["/start/", "/login/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|jpg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/start/")) || Response.error())
    );
  }
});
