// Minimal service worker to cache the app shell for offline use
const CACHE = 'eduai-cache-v1';
const FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/db.js',
  '/ai-mock.js'
];
self.addEventListener('install', (evt)=>{
  evt.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', (evt)=>{ evt.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (evt)=>{
  evt.respondWith(caches.match(evt.request).then(res=>res || fetch(evt.request).then(fres=>{ caches.open(CACHE).then(c=>c.put(evt.request, fres.clone())); return fres; }).catch(()=>caches.match('/index.html'))));
});
