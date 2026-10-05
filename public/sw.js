// AVVECKLAD service worker.
//
// Den tidigare versionen kunde svara med undefined och kapade då sidladdningen
// helt: "FetchEvent.respondWith received an error: Returned response is null".
// En trasig service worker kan låsa appen på ett sätt som inte går att laga
// från koden, eftersom sidan aldrig laddar och den nya koden aldrig når fram.
//
// Den här filen gör därför bara en sak: städar upp efter sig och försvinner.
// Inga fetch-lyssnare – appen går direkt mot nätet som vilken webbplats som
// helst. Offline-stödet tas upp igen separat, med ordentliga tester först.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignorera */
      }
      try {
        await self.registration.unregister();
      } catch {
        /* ignorera */
      }
      // Ladda om öppna flikar så de kör utan service worker
      try {
        const cs = await self.clients.matchAll({ type: 'window' });
        cs.forEach((c) => c.navigate(c.url));
      } catch {
        /* ignorera */
      }
    })()
  );
});
