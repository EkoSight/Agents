const CACHE_NAME = 'soil-doctor-scheduler-v2';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});
