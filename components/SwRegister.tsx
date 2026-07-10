'use client';
import { useEffect } from 'react';

// Registrerar service worker för PWA/offline-grund
export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
