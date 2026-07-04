// White-label: ALLT märkes-/sportspecifikt läses härifrån.
// Byt event genom att ändra NEXT_PUBLIC_TENANT (GOTHIA | PARTILLE).

export type Sport = 'fotboll' | 'handboll';
export type TenantKey = 'GOTHIA' | 'PARTILLE';

export type TenantConfig = {
  key: TenantKey;
  event: { name: string; shortName: string; sport: Sport; city: string; logoText: string };
  theme: {
    paper: string; ink: string; sidebar: string; sidebarInk: string;
    primary: string; primaryDark: string; accent: string; danger: string; ok: string;
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
    paper: '#F7F8F6', ink: '#14171A', sidebar: '#101418', sidebarInk: '#E6E9EC',
    primary: '#15924F', primaryDark: '#0F7A40', accent: '#E8A317', danger: '#DC2626', ok: '#15924F'
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
    paper: '#F6F7F8', ink: '#14171A', sidebar: '#0F1420', sidebarInk: '#E6E9EC',
    primary: '#1E5AA8', primaryDark: '#164780', accent: '#E8A317', danger: '#DC2626', ok: '#1E5AA8'
  },
  labels: {
    playingArea: 'Hall', playingAreas: 'Hallar', matchStart: 'Nedkast',
    match: 'Match', school: 'Skola', schools: 'Skolor', area: 'Område', areas: 'Områden'
  }
};

const ACTIVE = (process.env.NEXT_PUBLIC_TENANT ?? 'GOTHIA') as TenantKey;
export const tenant: TenantConfig = ACTIVE === 'PARTILLE' ? PARTILLE : GOTHIA;
