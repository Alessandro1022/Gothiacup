// Moduler som kan slås av och på per turnering.
export const FEATURE_KEYS = [
  'incidents', 'tasks', 'shifts',
  'areas', 'schools', 'arenas', 'map',
  'news', 'chat', 'docs',
  'reports', 'ai', 'crisis', 'staff', 'history', 'structure',
  // Etapp 2
  'stock'
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
export type Features = Partial<Record<FeatureKey, boolean>>;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  incidents: 'Incidenter', tasks: 'Uppgifter', shifts: 'Pass',
  areas: 'Områden', schools: 'Boende', arenas: 'Spelplatser', map: 'Karta',
  news: 'Nyheter', chat: 'Chatt', docs: 'Dokument',
  reports: 'Rapporter', ai: 'AI-assistent', crisis: 'Krisläge',
  staff: 'Personal', history: 'Historik', structure: 'Struktur',
  stock: 'Lager'
};

export type TenantColors = {
  primary?: string; primaryDark?: string; panel2?: string; accent?: string; bg?: string;
};

export type TenantLabels = {
  playingArea?: string; playingAreas?: string; matchStart?: string;
  school?: string; schools?: string; area?: string; areas?: string;
};

export type TenantRow = {
  id: string; slug: string; name: string; short_name: string;
  sport: string; city: string; logo_text: string; logo_url: string | null;
  colors: TenantColors; labels: TenantLabels; features: Features;
  active: boolean;
  // Paket och pris (del 8). plan_name är en ögonblicksbild: ändrar man vad
  // ett paket innehåller ska befintliga kunder inte tyst tappa moduler.
  plan_id: string | null;
  plan_name: string;
  price_per_year: number | null;
  plan_customized: boolean;
  billing_note: string;
};

export type PlanRow = {
  id: string; slug: string; name: string; description: string;
  features: Features; price_per_year: number | null;
  sort_order: number; active: boolean;
};

// Hur många moduler ett paket faktiskt ger. En modul räknas bara när den
// uttryckligen står som true – en omämnd nyckel är avstängd, så att en ny
// modul aldrig blir gratis för befintliga kunder. En helt tom uppsättning
// betyder att inget är satt ännu, och då visas allt.
export function countModules(features: Features): number {
  if (!features || Object.keys(features).length === 0) return FEATURE_KEYS.length;
  return FEATURE_KEYS.filter((k) => features[k] === true).length;
}

// Samma regel, för en enskild modul
export function hasModule(features: Features | null | undefined, k: FeatureKey): boolean {
  if (!features || Object.keys(features).length === 0) return true;
  return features[k] === true;
}

export function formatPrice(kr: number | null): string {
  if (kr === null || kr === undefined) return 'Offert';
  return `${new Intl.NumberFormat('sv-SE').format(kr)} kr/år`;
}

// Ord som följer sporten – används som förval när man väljer sport
export function labelsForSport(sport: string): Required<Pick<TenantLabels, 'playingArea' | 'playingAreas' | 'matchStart'>> {
  switch (sport) {
    case 'fotboll':
      return { playingArea: 'Plan', playingAreas: 'Planer', matchStart: 'Avspark' };
    case 'dans':
      return { playingArea: 'Scen', playingAreas: 'Scener', matchStart: 'Start' };
    case 'basket':
      return { playingArea: 'Plan', playingAreas: 'Planer', matchStart: 'Tipoff' };
    default:
      return { playingArea: 'Hall', playingAreas: 'Hallar', matchStart: 'Nedkast' };
  }
}
