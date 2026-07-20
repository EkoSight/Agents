const CACHE_NAME = 'soil-doctor-scheduler-v4';
const ASSETS = [
  'index.html',
  'styles.css',
  'app.js',
  'themes.js',
  'learning-engine.js',
  'news-engine.js',
  'vision-engine.js',
  'manifest.json',
  'assets/icon.jpg'
];

self.addEventListener('install', event => {
  // Activate the new worker immediately instead of waiting for old tabs to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
      // Take control of open pages right away so updates apply on next navigation.
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin app files (HTML/CSS/JS), so a new deploy is
// always picked up when online. Falls back to cache when offline. Cross-origin
// requests (news proxies, ChatGPT) bypass the cache and go straight to network.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin || req.method !== 'GET') {
    return; // let the browser handle cross-origin / non-GET normally
  }

  event.respondWith(
    fetch(req)
      .then(res => {
        // Refresh the cache copy in the background.
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('index.html')))
  );
});
