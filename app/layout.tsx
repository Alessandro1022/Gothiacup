import type { Metadata, Viewport } from 'next';
import { tenant } from '@/lib/tenant';
import { LanguageProvider } from '@/components/LanguageProvider';
import SwRegister from '@/components/SwRegister';
import './globals.css';

export const metadata: Metadata = {
  title: `${tenant.event.name} · TournamentOps`,
  description: 'Drift- och personalsystem',
  manifest: '/manifest.json',
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

  return (
    <html lang="sv" style={vars}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <SwRegister />
      </body>
    </html>
  );
}
