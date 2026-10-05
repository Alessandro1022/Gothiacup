import type { Metadata, Viewport } from 'next';
import { tenant } from '@/lib/tenant';
import { LanguageProvider } from '@/components/LanguageProvider';
import TenantProvider from '@/components/TenantProvider';
import SwRegister from '@/components/SwRegister';
import './globals.css';

export const metadata: Metadata = {
  title: `${tenant.event.name} · TournamentOps`,
  description: 'Drift- och personalsystem',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  appleWebApp: {
    capable: true,
    title: tenant.event.name,
    statusBarStyle: 'black-translucent'
  }
};

export const viewport: Viewport = {
  // Topbarens färg, så statusfältet smälter in i stället för att bli vitt
  themeColor: tenant.theme.panel2,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = tenant.theme;
  const vars = {
    '--bg': t.bg, '--panel': t.panel, '--panel-2': t.panel2, '--line': t.line,
    '--ink': t.ink, '--muted': t.muted,
    '--sidebar-ink': t.sidebarInk, '--sidebar-muted': t.sidebarMuted,
    '--primary': t.primary, '--primary-dark': t.primaryDark,
    '--accent': t.accent, '--danger': t.danger, '--ok': t.ok
  } as React.CSSProperties;

  // Räddningslucka: körs före alla bundles, så den fungerar även när en gammal
  // service worker har låst sidladdningen. Avregistrerar allt och tömmer
  // cachen. Laddar om bara när något faktiskt togs bort, så den kan inte
  // loopa – efter första körningen finns inget kvar att avregistrera.
  const swReset = `(function(){try{
if(!('serviceWorker' in navigator))return;
navigator.serviceWorker.getRegistrations().then(function(rs){
var had=rs.length>0;
return Promise.all(rs.map(function(r){return r.unregister()})).then(function(){
return window.caches?caches.keys().then(function(ks){
return Promise.all(ks.map(function(k){return caches.delete(k)}))}):null
}).then(function(){if(had)location.reload()})
}).catch(function(){})
}catch(e){}})();`;

  return (
    <html lang="sv" style={vars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: swReset }} />
      </head>
      <body>
        <TenantProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </TenantProvider>
        <SwRegister />
      </body>
    </html>
  );
}
