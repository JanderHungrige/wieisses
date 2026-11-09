// @ts-check
/// <reference lib="webworker" />
// The service worker of the installable app (doc 03, "Service worker"): page loads go to the
// network, and only when that fails does the cached offline page answer. API calls, built assets,
// media and voice clips are never touched — no child's data is ever cached.

const CACHE = 'wieisses-offline-v1';
const OFFLINE = ['/offline.html', '/offline.css', '/icons/icon.svg'];

const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE))
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match('/offline.html')) ?? Response.error()),
  );
});
