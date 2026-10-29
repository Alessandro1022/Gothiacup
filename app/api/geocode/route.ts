// Adressökning för kartan: adress → koordinat.
//
// Går via servern i stället för direkt från telefonen, av tre skäl:
// OpenStreetMaps sökning kräver att anropen identifierar appen, högst ett
// anrop per sekund, och bara inloggad personal ska kunna använda den.
// Faller tillbaka på Photon (också OpenStreetMap-data) om den första
// tjänsten inte svarar eller inte hittar något.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Hit = { lat: number; lng: number; label: string };
type Box = { w: number; s: number; e: number; n: number };

const UA = 'TournamentOps/1.0 (drift- och personalsystem för turneringar)';
const NOMINATIM = process.env.GEOCODE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const PHOTON = process.env.GEOCODE_PHOTON_URL || 'https://photon.komoot.io';

// Samma fråga två gånger ska inte belasta tjänsten igen
const cache = new Map<string, Hit | null>();
let lastCall = 0;

async function throttle() {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function parseBox(raw: string | null): Box | null {
  if (!raw) return null;
  const v = raw.split(',').map(Number);
  if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) return null;
  const [w, s, e, n] = v;
  if (w >= e || s >= n || Math.abs(s) > 90 || Math.abs(n) > 90 || Math.abs(w) > 180 || Math.abs(e) > 180) {
    return null;
  }
  return { w, s, e, n };
}

function toHit(lat: unknown, lng: unknown, label: string): Hit | null {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { lat: a, lng: b, label };
}

async function nominatim(q: string, box: Box | null): Promise<Hit | null> {
  const p = new URLSearchParams({
    format: 'jsonv2', limit: '1', countrycodes: 'se', 'accept-language': 'sv', q
  });
  if (box) {
    p.set('viewbox', `${box.w},${box.n},${box.e},${box.s}`);
    p.set('bounded', '1');
  }
  await throttle();
  const res = await fetch(`${NOMINATIM}/search?${p}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(7000)
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows = await res.json();
  const r = Array.isArray(rows) ? rows[0] : null;
  return r ? toHit(r.lat, r.lon, String(r.display_name ?? '')) : null;
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    countrycode?: string; name?: string; street?: string; housenumber?: string; city?: string;
  };
};

async function photon(q: string, box: Box | null): Promise<Hit | null> {
  const p = new URLSearchParams({ q, limit: '5' });
  if (box) p.set('bbox', `${box.w},${box.s},${box.e},${box.n}`);
  const res = await fetch(`${PHOTON}/api/?${p}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(7000)
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const f = (data.features ?? []).find((x) => x.properties?.countrycode === 'SE');
  const c = f?.geometry?.coordinates;
  if (!f || !c) return null;
  const pr = f.properties ?? {};
  const street = [pr.street, pr.housenumber].filter(Boolean).join(' ');
  const label = [pr.name, street, pr.city].filter(Boolean).join(', ');
  return toHit(c[1], c[0], label);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ error: 'Sökningen är för kort' }, { status: 400 });
  const box = parseBox(url.searchParams.get('box'));

  const key = `${q.toLowerCase()}|${box ? [box.w, box.s, box.e, box.n].map((v) => v.toFixed(3)).join(',') : ''}`;
  if (cache.has(key)) return NextResponse.json({ hit: cache.get(key) });

  let hit: Hit | null = null;
  let failures = 0;
  try { hit = await nominatim(q, box); } catch { failures++; }
  if (!hit) {
    try { hit = await photon(q, box); } catch { failures++; }
  }

  // Båda tjänsterna nere: säg det, i stället för att låtsas att adressen inte finns
  if (!hit && failures === 2) {
    return NextResponse.json({ error: 'Adressökningen svarar inte just nu' }, { status: 502 });
  }

  if (cache.size > 500) cache.clear();
  cache.set(key, hit);
  return NextResponse.json({ hit });
}
