const SHELL_CACHE_NAME = "home-control-shell-v1";
const SHELL_CACHE_PREFIX = "home-control-shell-";

const PRECACHE_PATHS = [
  "./",
  "./manifest.webmanifest",
  "./icons/pwa-192x192.png",
  "./icons/pwa-512x512.png",
  "./icons/apple-touch-icon.png",
];

function isCacheableStaticPath(pathname) {
  return (
    pathname.includes("/_next/static/") ||
    pathname.includes("/Fonts/") ||
    pathname.includes("/icons/") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_PATHS.map((path) => cache.add(new Request(path, { cache: "reload" }))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin APIs (Cloudflare Worker, EMQX MQTT, Archive.org audio streams)
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, copy));
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);

          if (cached) return cached;

          const fallback = await caches.match("./");

          return fallback || new Response("Offline", { status: 503, statusText: "Offline" });
        }),
    );

    return;
  }

  if (isCacheableStaticPath(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, copy));
          }

          return response;
        });
      }),
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, copy));
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});
