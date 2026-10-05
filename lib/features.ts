// Moduler som kan slås av och på per turnering.
export const FEATURE_KEYS = [
  'incidents', 'tasks', 'shifts',
  'areas', 'schools', 'arenas', 'map',
  'news', 'chat', 'docs',
  'reports', 'ai', 'crisis', 'staff', 'history', 'structure'
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
export type Features = Partial<Record<FeatureKey, boolean>>;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  incidents: 'Incidenter', tasks: 'Uppgifter', shifts: 'Pass',
  areas: 'Områden', schools: 'Boende', arenas: 'Spelplatser', map: 'Karta',
  news: 'Nyheter', chat: 'Chatt', docs: 'Dokument',
  reports: 'Rapporter', ai: 'AI-assistent', crisis: 'Krisläge',
  staff: 'Personal', history: 'Historik', structure: 'Struktur'
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
};

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
