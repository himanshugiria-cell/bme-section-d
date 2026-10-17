/* Only this public BME website is cached. Google Drive and Forms are never cached. */
'use strict';
const CACHE_PREFIX = 'bme-section-d-shell-';
const CACHE = CACHE_PREFIX + '2026-10-16-unit-iii-v1';
const BASE = new URL('./', self.location.href);
const HOME = new URL('./', BASE).href;
const OFFLINE = new URL('offline.html', BASE).href;
const SHELL = [
  './', './offline.html', './manifest.webmanifest', './pwa.css', './pwa.js',
  './icons/bme-192.png', './icons/bme-512.png', './icons/bme-maskable-512.png',
  './icons/apple-touch-icon.png'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function homeRequest(url) {
  return url.pathname === BASE.pathname || url.pathname === BASE.pathname + 'index.html';
}
function cacheablePage(url) {
  return homeRequest(url) || url.pathname === BASE.pathname + 'offline.html' ||
    url.pathname === BASE.pathname + 'notes/unit-i-supplement.html' ||
    url.pathname === BASE.pathname + 'notes/unit-ii-supplement.html' ||
    url.pathname === BASE.pathname + 'notes/unit-iii-study-guide.html';
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const isPage = request.mode === 'navigate';
  const isAsset = SHELL.includes(url.href);
  if ((!isPage || !cacheablePage(url)) && !isAsset) return;
  // Ignore query variants rather than storing an unbounded list of pages.
  if (url.search) return;
  const key = homeRequest(url) ? HOME : request;

  event.respondWith((async function () {
    const cache = await caches.open(CACHE);
    try {
      // Prefer fresh course information whenever the network is available.
      const response = await fetch(request, {cache: 'no-cache'});
      if (response.ok && response.type === 'basic') {
        await cache.put(key, response.clone()).catch(() => {});
        return response;
      }
      // A real 404 must remain a 404; do not disguise removed pages as cached content.
      return response;
    } catch (error) {
      const saved = await cache.match(key);
      if (saved) return saved;
      if (isPage) {
        const fallback = await cache.match(OFFLINE);
        if (fallback) {
          // A fallback for a nested notes URL still needs links rooted at the app.
          const html = (await fallback.text()).replace('<head>', '<head><base href="' + BASE.href + '">');
          return new Response(html, {headers: {'Content-Type': 'text/html; charset=utf-8'}});
        }
        return new Response('You are offline. Reconnect to open this BME page.', {
          status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
      return Response.error();
    }
  })());
});
