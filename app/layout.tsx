import type { Metadata, Viewport } from 'next';
import { tenant } from '@/lib/tenant';
import { LanguageProvider } from '@/components/LanguageProvider';
import './globals.css';

export const metadata: Metadata = {
  title: `${tenant.event.name} · TournamentOps`,
  description: 'Drift- och personalsystem',
  manifest: '/manifest.json'
};

export const viewport: Viewport = {
  themeColor: tenant.theme.sidebar,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = tenant.theme;
  const vars = {
    '--paper': t.paper, '--ink': t.ink, '--sidebar': t.sidebar, '--sidebar-ink': t.sidebarInk,
    '--primary': t.primary, '--primary-dark': t.primaryDark,
    '--accent': t.accent, '--danger': t.danger, '--ok': t.ok
  } as React.CSSProperties;

  return (
    <html lang="sv" style={vars}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
