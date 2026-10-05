// Service worker: funciona offline após a primeira visita (stale-while-revalidate).
const VERSION = 'ggt-v0.7.1';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/data.js', 'js/sim.js', 'js/score.js', 'js/save.js', 'js/util.js', 'js/office.js', 'js/audio.js', 'js/names.js', 'js/catalog.js', 'js/world.js', 'js/social.js', 'js/press.js', 'js/indie.js',
  'js/map.js', 'js/team.js', 'js/lifeevents.js', 'js/city.js', 'js/citymap.js', 'js/sprites.js', 'js/ui/build.js', 'js/ui/city.js', 'js/ui/dom.js', 'js/ui/ctrl.js', 'js/ui/screens.js', 'js/ui/screens2.js', 'js/ui/screens3.js', 'js/ui/screens4.js', 'js/achieve.js', 'js/legacy.js', 'js/market.js', 'js/media.js', 'js/modes.js', 'js/ui/screens5.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
