'use client';
import { useEffect } from 'react';

// Registrerar service worker och ser till att nya versioner tas i bruk direkt.
// Utan det här kan en hemskärmsapp sitta kvar på en gammal version i dagar.
export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;

    const onControllerChange = () => {
      // Ny service worker tog över – ladda om en gång så sidan matchar den
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Leta efter ny version vid varje start och sedan en gång i timmen
        reg.update().catch(() => {});
        const id = setInterval(() => reg.update().catch(() => {}), 3600000);

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('skip-waiting');
            }
          });
        });

        return () => clearInterval(id);
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
