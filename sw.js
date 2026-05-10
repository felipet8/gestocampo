// GestoCampo — Service Worker v2
// Estrategia: cache-first para assets CDN, network-first para el HTML

const CACHE_NAME = 'gestocampo-v2';
const STATIC_ASSETS = [
  './gestocampo.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@300;400;500;600&display=swap',
  'https://fonts.gstatic.com/s/cormorantgaramond/v22/BXRovF3Pi-DLmw2JnBgPMC4E2jtaWFSqgA.woff2',
];

// ── Instalar: pre-cachear assets ──────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activar: limpiar caches viejos ───────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('gestocampo-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first para HTML, cache-first para el resto ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Dejar pasar JSONBin y Google Fonts CSS (siempre necesita red)
  if (url.hostname === 'api.jsonbin.io') return;

  // Network-first para el HTML (obtiene siempre la versión más nueva)
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const rc = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, rc));
          return r;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./gestocampo.html')))
    );
    return;
  }

  // Cache-first para todo lo demás (fuentes, librerías CDN)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r && r.ok) {
          const rc = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, rc));
        }
        return r;
      }).catch(() => caches.match('./gestocampo.html'));
    })
  );
});

// ── Background Sync ───────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-db') {
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SYNC_NOW' }));
      })
    );
  }
});

// ── Push notifications (futuro) ──────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'GestoCampo', {
      body: data.body || '',
      icon: './icon.svg',
    })
  );
});
