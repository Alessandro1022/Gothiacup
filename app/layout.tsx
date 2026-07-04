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
  themeColor: tenant.theme.bg,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = tenant.theme;
  const vars = {
    '--bg': t.bg, '--panel': t.panel, '--line': t.line,
    '--ink': t.ink, '--muted': t.muted,
    '--primary': t.primary, '--primary-dark': t.primaryDark, '--glow': t.glow,
    '--accent': t.accent, '--danger': t.danger, '--ok': t.ok
  } as React.CSSProperties;

  return (
    <html lang="sv" style={vars}>
      <body>
        {/* Holografisk plan: ambient bakgrundslager på alla sidor */}
        <div className="field-layer" aria-hidden="true">
          <div className="field-glow" />
          <svg className="field-lines" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="40" y="40" width="920" height="520" rx="4" />
              <line x1="500" y1="40" x2="500" y2="560" />
              <circle cx="500" cy="300" r="80" />
              <circle cx="500" cy="300" r="3" fill="currentColor" />
              <rect x="40" y="170" width="130" height="260" />
              <rect x="830" y="170" width="130" height="260" />
              <rect x="40" y="235" width="45" height="130" />
              <rect x="915" y="235" width="45" height="130" />
              <path d="M 170 245 A 80 80 0 0 1 170 355" />
              <path d="M 830 245 A 80 80 0 0 0 830 355" />
            </g>
          </svg>
          <div className="field-scan" />
        </div>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
