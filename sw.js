// VilleSûre Service Worker — iOS PWA optimisé
// Stratégie : network-first pour tout, pas de cache HTML

const CACHE_NAME = 'villesure-v4';
const STATIC_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

// Installation — on prend le contrôle immédiatement
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// Activation — on supprime TOUS les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — stratégie différente selon le type de ressource
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // JAMAIS de cache pour :
  // - l'HTML principal (index.html)
  // - les APIs Supabase
  // - Nominatim (géolocalisation)
  // - OneSignal
  const neverCache =
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('onesignal.com');

  if (neverCache) {
    // Network only — si offline, retourne une erreur claire
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Pour les assets statiques (CSS, JS Leaflet etc.) : cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('', { status: 503 }));
    })
  );
});
