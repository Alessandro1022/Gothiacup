// Service worker · TournamentOps
// Regel nummer ett: service workern får ALDRIG kunna göra appen vit.
// Därför rörs inte sidnavigeringar alls – de går rakt ut på nätet, så en ny
// deploy slår igenom direkt. Bara versionsstämplade statiska filer cachas,
// och bara när svaret är helt (res.ok). Ett trasigt svar cachas aldrig.
const CACHE = 'tops-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Städa bort alla äldre cacher, inklusive de som kan innehålla 404-svar
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Tillåt att appen tvingar fram ny version utan att användaren rensar något
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Bara egna GET-anrop är intressanta
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== location.origin) return;

  // Sidor, API, inloggning: aldrig service workern. Går rakt till nätet.
  // Det här är skillnaden mot förra versionen – ingen cachead HTML som kan
  // peka på chunkar som inte längre finns på servern.
  if (req.mode === 'navigate' || req.destination === 'document') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Versionsstämplade filer: cache-first, säkert
  const cacheable =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png';

  if (!cacheable) return;

  e.respondWith(
    (async () => {
      try {
        const c = await caches.open(CACHE);
        const hit = await c.match(req);
        // Cachade felsvar ska inte få leva vidare
        if (hit && hit.ok) return hit;
        if (hit) await c.delete(req);

        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') {
          try {
            await c.put(req, res.clone());
          } catch {
            // Fullt lagringsutrymme ska inte stoppa svaret
          }
        }
        return res;
      } catch {
        // Nätet nere och inget i cachen: ge ett riktigt Response-objekt,
        // aldrig undefined. undefined här = nätverksfel = vit skärm.
        const c = await caches.open(CACHE).catch(() => null);
        const hit = c ? await c.match(req).catch(() => null) : null;
        if (hit) return hit;
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});
