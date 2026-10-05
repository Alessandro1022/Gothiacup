'use client';
import { useEffect } from 'react';

// Registrerar INGEN service worker längre – den avvecklades för att en trasig
// version kan låsa hela appen utan att gå att laga från koden.
// I stället städas allt som finns kvar från tidigare versioner bort.
export default function SwRegister() {
  useEffect(() => {
    const cleanup = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const rs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(rs.map((r) => r.unregister()));
        }
      } catch {
        /* ignorera */
      }
      try {
        if (typeof caches !== 'undefined') {
          const ks = await caches.keys();
          await Promise.all(ks.map((k) => caches.delete(k)));
        }
      } catch {
        /* ignorera */
      }
    };
    cleanup();
  }, []);

  return null;
}
