// Service worker: lets the site install as an app, and falls back to the last copy it saw
// when there's no signal. Always tries the network first, so a new deploy shows up right away.
const CACHE = 'brecktrails-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const { request } = e;
  // Only this site's own files; leave YouTube, OpenSkiMap, weather etc. alone
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
