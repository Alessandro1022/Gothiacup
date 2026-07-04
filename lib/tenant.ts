// White-label: ALLT märkes-/sportspecifikt läses härifrån.
// Byt event genom att ändra NEXT_PUBLIC_TENANT (GOTHIA | PARTILLE).
// Del 2: "stadium at night"-tema — mörk kommandocentral med holografisk glöd.

export type Sport = 'fotboll' | 'handboll';
export type TenantKey = 'GOTHIA' | 'PARTILLE';

export type TenantConfig = {
  key: TenantKey;
  event: { name: string; shortName: string; sport: Sport; city: string; logoText: string };
  theme: {
    bg: string;          // djup arena-natt
    panel: string;       // glaspanel
    line: string;        // glödande kantlinje
    ink: string;         // primär text
    muted: string;       // sekundär text
    primary: string;     // glödfärg (turf/arena)
    primaryDark: string;
    glow: string;        // rgba-glöd för skuggor
    accent: string;      // amber-varning
    danger: string;
    ok: string;
  };
  labels: {
    playingArea: string; playingAreas: string; // "Plan/Planer" vs "Hall/Hallar"
    matchStart: string;                        // "Avspark" vs "Nedkast"
    match: string; school: string; schools: string; area: string; areas: string;
  };
};

export const GOTHIA: TenantConfig = {
  key: 'GOTHIA',
  event: { name: 'Gothia Cup', shortName: 'Gothia', sport: 'fotboll', city: 'Göteborg', logoText: 'GC' },
  theme: {
    bg: '#050907',       // djup arena-natt, grön ton
    panel: 'rgba(14, 22, 18, 0.72)',
    line: 'rgba(34, 197, 94, 0.16)',
    ink: '#E9EFEA',
    muted: '#7E9488',
    primary: '#22C55E',
    primaryDark: '#16A34A',
    glow: 'rgba(34, 197, 94, 0.35)',
    accent: '#FBBF24',
    danger: '#F87171',
    ok: '#22C55E'
  },
  labels: {
    playingArea: 'Plan', playingAreas: 'Planer', matchStart: 'Avspark',
    match: 'Match', school: 'Skola', schools: 'Skolor', area: 'Område', areas: 'Områden'
  }
};

export const PARTILLE: TenantConfig = {
  key: 'PARTILLE',
  event: { name: 'Partille Cup', shortName: 'Partille', sport: 'handboll', city: 'Partille', logoText: 'PC' },
  theme: {
    bg: '#04070E',
    panel: 'rgba(12, 18, 30, 0.72)',
    line: 'rgba(76, 141, 255, 0.16)',
    ink: '#E8EDF5',
    muted: '#7E8CA6',
    primary: '#4C8DFF',
    primaryDark: '#2F6FE0',
    glow: 'rgba(76, 141, 255, 0.35)',
    accent: '#FBBF24',
    danger: '#F87171',
    ok: '#4C8DFF'
  },
  labels: {
    playingArea: 'Hall', playingAreas: 'Hallar', matchStart: 'Nedkast',
    match: 'Match', school: 'Skola', schools: 'Skolor', area: 'Område', areas: 'Områden'
  }
};

const ACTIVE = (process.env.NEXT_PUBLIC_TENANT ?? 'GOTHIA') as TenantKey;
export const tenant: TenantConfig = ACTIVE === 'PARTILLE' ? PARTILLE : GOTHIA;
