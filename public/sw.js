// MetroMeet PRO Lightweight PWA Service Worker
const CACHE_NAME = 'metromeet-pro-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Never intercept API, LiveKit, WebSockets, or non-GET requests
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    request.url.includes('livekit') ||
    request.url.startsWith('chrome-extension')
  ) {
    return;
  }
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
