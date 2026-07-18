/* global self, caches, clients */

const scopePath = new URL(self.registration.scope).pathname
  .replace(/[^a-z0-9]+/gi, "-")
  .replace(/^-|-$/g, "") || "root";
const CACHE_PREFIX = `tijaratk-${scopePath}-pwa`;
const CACHE_NAME = `${CACHE_PREFIX}-v1`;
const OFFLINE_URL = "/offline";
const registrationScopePath = new URL(self.registration.scope).pathname.replace(
  /\/$/,
  "",
);
const isScopedClientPath = (pathname) =>
  pathname === registrationScopePath ||
  pathname.startsWith(`${registrationScopePath}/`);
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
];
const PUSH_MESSAGE_TYPES = new Set([
  "merchant.order.created",
  "admin.order.created",
  "merchant.assignment.created",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      }),
    );
    return;
  }

  const immutableAsset =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE_URLS.includes(url.pathname);
  if (!immutableAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (
    !payload ||
    payload.version !== 1 ||
    typeof payload.eventId !== "string" ||
    !PUSH_MESSAGE_TYPES.has(payload.type) ||
    typeof payload.title !== "string" ||
    typeof payload.body !== "string" ||
    typeof payload.url !== "string" ||
    !payload.url.startsWith("/") ||
    payload.url.startsWith("//") ||
    typeof payload.tag !== "string" ||
    typeof payload.createdAt !== "string"
  ) {
    return;
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        tag: payload.tag,
        renotify: true,
        dir: "rtl",
        lang: "ar-EG",
        data: {
          url: payload.url,
          eventId: payload.eventId,
          type: payload.type,
        },
      }),
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windows) => {
          for (const client of windows) {
            const clientPath = new URL(client.url).pathname;
            if (isScopedClientPath(clientPath)) {
              client.postMessage(payload);
            }
          }
        }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url;
  if (
    typeof targetPath !== "string" ||
    !targetPath.startsWith("/") ||
    targetPath.startsWith("//")
  ) {
    return;
  }
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      async (windows) => {
        for (const client of windows) {
          const clientPath = new URL(client.url).pathname;
          if (!isScopedClientPath(clientPath)) continue;
          if ("navigate" in client) await client.navigate(targetUrl);
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(targetUrl);
      },
    ),
  );
});
