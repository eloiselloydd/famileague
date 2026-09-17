/* Famileague - service worker
   Ported from the Lloydd Cup, same strategy:
   - HTML/navigation: network-first, so a new deploy always shows the latest
     version when online, and the cached copy keeps it working offline.
   - Icons/manifest (same-origin assets): cache-first for speed.
   - Everything cross-origin (Supabase live sync) is left untouched - we never
     intercept it, so syncing behaves exactly as before.
*/
var CACHE = 'famileague-v1';
var SHELL = ['/', '/index.html', '/manifest.webmanifest',
             '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 // only cache reads
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // leave Supabase & co. alone

  // HTML pages -> network-first (latest deploy wins, offline falls back to cache)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('/index.html'); });
      })
    );
    return;
  }

  // Same-origin assets -> cache-first, fall back to network
  e.respondWith(
    caches.match(req).then(function (m) {
      return m || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
