/* Floss Fox service worker: offline support. Same-origin GET only; HTML network-first, static cache-first. */
const CACHE = 'flossfox-v1.8-2';
const CORE = [
  './',
  "about.html",
  "fabric.html",
  "fabric/calc.js",
  "fabric/ui.js",
  "favicon.svg",
  "index.html",
  "parse.js",
  "pip.js",
  "privacy.html",
  "projects.js",
  "retailers.js",
  "threads.js",
  "tour.js",
  "assets/icons/icon-192.png",
  "assets/icons/apple-touch-icon.png",
  "assets/pip/pip-celebrating-160.png",
  "assets/pip/pip-celebrating-160.webp",
  "assets/pip/pip-celebrating-320.webp",
  "assets/pip/pip-cross-stitch-160.png",
  "assets/pip/pip-cross-stitch-160.webp",
  "assets/pip/pip-discovery-160.png",
  "assets/pip/pip-face-icon-64.png",
  "assets/pip/pip-greeting-160.png",
  "assets/pip/pip-greeting-160.webp",
  "assets/pip/pip-greeting-320.png",
  "assets/pip/pip-greeting-320.webp",
  "assets/pip/pip-greeting-480.png",
  "assets/pip/pip-greeting-480.webp",
  "assets/pip/pip-needle-160.png",
  "assets/pip/pip-needle-160.webp",
  "assets/pip/pip-organizing-160.png",
  "assets/pip/pip-presenting-160.png",
  "assets/pip/pip-saved-160.png",
  "assets/pip/pip-saved-160.webp",
  "confirm.js",
  "skeins/calc.js",
  "skeins/ui.js",
  "skeins/ui.css",
  "skeins/EVIDENCE.md",
  "skeins/evidence.json",
  'manifest.webmanifest'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('flossfox-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // never touch cross-origin (retailers, affiliate links)
  const html = r.mode === 'navigate' || (r.headers.get('accept') || '').includes('text/html');
  if (html) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, {ignoreSearch: true}).then(m => m || caches.match('./'))));
  } else {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
  }
});
