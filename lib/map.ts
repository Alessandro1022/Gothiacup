// Hjälpfunktioner för kartan. Rena funktioner utan Leaflet, så att listan
// under kartan kan använda dem och så att de går att testa utan webbläsare.

export type PlaceType = 'school' | 'arena';
export type AccKind = 'skola' | 'hotell' | 'vandrarhem' | 'camping';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'ok' | 'issue' | 'inc' | 'crit';

export type Inc = { id: string; title: string; severity: Severity; created_at: string };

export type Place = {
  key: string;                // "school:<id>" eller "arena:<id>"
  id: string;
  type: PlaceType;
  name: string;
  lat: number | null;
  lng: number | null;
  flagged: boolean;           // koordinaten flaggades som fel vid import
  hasFlagColumn: boolean;     // finns coord_flagged i databasen
  raw: string;                // koordinaten som den stod i importfilen
  kind: AccKind | null;       // bara boenden
  areaId: string | null;
  area: string;
  address: string;
  contactName: string;
  contactPhone: string;
  assembly: string;           // återsamlingsplats (del 17)
  care: string;               // närmaste vård (del 17)
  emergency: string;          // nödinfo (del 17)
  club: string;
  capacity: number | null;
  surfaces: number | null;
  inHouse: number;
  teamsIn: number;
  teamsExpected: number;
  incidents: Inc[];
  issues: number;
};

export const KIND_LABEL: Record<AccKind, string> = {
  skola: 'Skola', hotell: 'Hotell', vandrarhem: 'Vandrarhem', camping: 'Camping'
};

const KIND_LETTER: Record<AccKind, string> = {
  skola: 'S', hotell: 'H', vandrarhem: 'V', camping: 'C'
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Låg', medium: 'Medel', high: 'Hög', critical: 'Kritisk'
};

// Godkänn bara riktiga koordinater. 0,0 är ett vanligt importfel som
// annars lägger en markör i Atlanten utanför Afrika.
export function validCoord(lat: unknown, lng: unknown): [number, number] | null {
  const a = typeof lat === 'string' ? Number(lat) : lat;
  const b = typeof lng === 'string' ? Number(lng) : lng;
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return [a, b];
}

export function statusOf(p: Place): Status {
  if (p.incidents.some((i) => i.severity === 'critical' || i.severity === 'high')) return 'crit';
  if (p.incidents.length) return 'inc';
  if (p.issues) return 'issue';
  return 'ok';
}

export const STATUS_RANK: Record<Status, number> = { crit: 3, inc: 2, issue: 1, ok: 0 };

// Avstånd i meter (haversine). Räcker gott inom en stad.
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function fmtDistance(m: number): string {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return `${km < 9.5 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Punkterna som kartan ska zooma till från början. En enda felaktig
// koordinat (en skola som hamnat i Skåne) ska inte tvinga ut kartan så
// långt att Göteborg blir en prick, så punkter långt från mittpunkten
// räknas bort här. De visas fortfarande när man zoomar ut.
export function corePoints(points: [number, number][], radiusKm = 60): [number, number][] {
  if (points.length < 3) return points;
  const c: [number, number] = [median(points.map((p) => p[0])), median(points.map((p) => p[1]))];
  const core = points.filter((p) => distanceM(c, p) <= radiusKm * 1000);
  return core.length ? core : points;
}

// Sökruta för adressökning: där turneringens platser redan ligger, med
// marginal. Stoppar att "Skolgatan 3" hamnar i fel stad.
export type Box = { w: number; s: number; e: number; n: number };

export function searchBox(points: [number, number][], padKm = 30): Box | null {
  const core = corePoints(points);
  if (!core.length) return null;
  const lats = core.map((p) => p[0]);
  const lngs = core.map((p) => p[1]);
  const mid = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = padKm / 111;
  const dLng = padKm / (111 * Math.max(0.2, Math.cos(mid * Math.PI / 180)));
  return {
    w: Math.min(...lngs) - dLng, s: Math.min(...lats) - dLat,
    e: Math.max(...lngs) + dLng, n: Math.max(...lats) + dLat
  };
}

// Sökfråga för adressökning. Staden läggs till om adressen saknar den,
// annars är "Storgatan 1" tvetydig i hela Sverige.
export function geocodeQuery(p: Place, city: string): string {
  const base = (p.address || p.name).trim();
  if (!city) return base;
  return base.toLowerCase().includes(city.toLowerCase()) ? base : `${base}, ${city}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[c]);
}

// Markörens utseende. Form säger vad platsen är (rund = boende, fyrkant =
// spelplats), färg säger läget, bokstaven säger boendetyp.
export function markerHtml(p: Place, selected: boolean): string {
  const st = statusOf(p);
  const shape = p.type === 'arena' ? 'sq' : 'ci';
  const letter = p.type === 'school' ? KIND_LETTER[p.kind ?? 'skola'] : '';
  const ring = st === 'inc' || st === 'crit' ? '<i class="mk-ring"></i>' : '';
  const count = p.incidents.length > 1 ? `<b class="mk-n">${p.incidents.length}</b>` : '';
  return `<div class="mk mk-${shape} mk-${p.type} mk-${st}${selected ? ' mk-sel' : ''}">` +
    `${ring}<span class="mk-dot">${letter}</span>${count}</div>`;
}

export function markerSignature(p: Place, selected: boolean): string {
  return `${statusOf(p)}|${p.kind}|${p.incidents.length}|${selected ? 1 : 0}`;
}

export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.length >= 3 ? `tel:${digits}` : null;
}

// Vägbeskrivning i telefonens egen kartapp. På iPhone öppnar
// maps.apple.com Kartor direkt, annars Google Maps.
export function directionsHref(lat: number, lng: number, ios: boolean): string {
  return ios
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
