'use client';
// Karta utan externa beroenden: koordinaterna projiceras direkt till SVG.
// Snabbt på mobil, ingen API-nyckel, ingen kostnad.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Place = {
  id: string; name: string; lat: number | null; lng: number | null;
  kind: 'school' | 'arena'; area: string | null; issues: number; incidents: number;
};

const W = 1000, H = 700, PAD = 60;

export default function MapClient() {
  const supabase = createClient();
  const [places, setPlaces] = useState<Place[]>([]);
  const [show, setShow] = useState<'all' | 'school' | 'arena'>('all');
  const [sel, setSel] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: sc }, { data: ar }, { data: inc }, { data: iss }] = await Promise.all([
      supabase.from('schools').select('id,name,lat,lng,area_id'),
      supabase.from('arenas').select('id,name,lat,lng,area_id'),
      supabase.from('incidents').select('location_type,location_id').neq('status', 'resolved'),
      supabase.from('room_issues').select('school_id').neq('status', 'resolved')
    ]);
    const { data: areas } = await supabase.from('areas').select('id,name');
    const areaName = (id: string | null) => areas?.find((a) => a.id === id)?.name ?? null;

    const rows: Place[] = [
      ...(sc ?? []).map((s) => ({
        id: s.id, name: s.name, lat: s.lat, lng: s.lng, kind: 'school' as const,
        area: areaName(s.area_id),
        issues: (iss ?? []).filter((i) => i.school_id === s.id).length,
        incidents: (inc ?? []).filter((i) => i.location_type === 'school' && i.location_id === s.id).length
      })),
      ...(ar ?? []).map((a) => ({
        id: a.id, name: a.name, lat: a.lat, lng: a.lng, kind: 'arena' as const,
        area: areaName(a.area_id), issues: 0,
        incidents: (inc ?? []).filter((i) => i.location_type === 'arena' && i.location_id === a.id).length
      }))
    ];
    setPlaces(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel('map-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_issues' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const withCoords = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null),
    [places]
  );
  const visible = useMemo(
    () => withCoords.filter((p) => show === 'all' || p.kind === show),
    [withCoords, show]
  );

  // Projektion: linjär, med breddgradskorrigering så proportionerna stämmer
  const proj = useMemo(() => {
    if (!withCoords.length) return null;
    const lats = withCoords.map((p) => p.lat as number);
    const lngs = withCoords.map((p) => p.lng as number);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const spanX = Math.max((maxLng - minLng) * k, 1e-6);
    const spanY = Math.max(maxLat - minLat, 1e-6);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;
    return {
      x: (lng: number) => offX + (lng - minLng) * k * scale,
      y: (lat: number) => H - offY - (lat - minLat) * scale
    };
  }, [withCoords]);

  const missing = places.length - withCoords.length;

  const color = (p: Place) =>
    p.incidents > 0 ? 'var(--danger)' : p.issues > 0 ? '#E0A106' : p.kind === 'arena' ? 'var(--primary)' : 'var(--ok)';

  return (
    <>
      <h1 className="page-title">Karta</h1>
      <div className="page-sub">
        {loading ? 'Laddar…' : `${withCoords.length} platser utsatta${missing ? ` · ${missing} saknar koordinater` : ''}`}
      </div>

      <div className="chips">
        <button className={`chip ${show === 'all' ? 'active' : ''}`} onClick={() => setShow('all')}>Alla</button>
        <button className={`chip ${show === 'school' ? 'active' : ''}`} onClick={() => setShow('school')}>Skolor</button>
        <button className={`chip ${show === 'arena' ? 'active' : ''}`} onClick={() => setShow('arena')}>Spelplatser</button>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {proj && (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <rect x="0" y="0" width={W} height={H} fill="#EAF0F6" rx="12" />
            {[...Array(9)].map((_, i) => (
              <line key={`v${i}`} x1={(W / 8) * i} y1="0" x2={(W / 8) * i} y2={H} stroke="#DCE5EE" strokeWidth="1" />
            ))}
            {[...Array(7)].map((_, i) => (
              <line key={`h${i}`} x1="0" y1={(H / 6) * i} x2={W} y2={(H / 6) * i} stroke="#DCE5EE" strokeWidth="1" />
            ))}
            {visible.map((p) => {
              const cx = proj.x(p.lng as number), cy = proj.y(p.lat as number);
              const active = sel?.id === p.id;
              return (
                <g key={`${p.kind}-${p.id}`} onClick={() => setSel(p)} style={{ cursor: 'pointer' }}>
                  {p.incidents > 0 && <circle cx={cx} cy={cy} r="18" fill="var(--danger)" opacity="0.18" />}
                  {p.kind === 'arena' ? (
                    <rect x={cx - 7} y={cy - 7} width="14" height="14" rx="3"
                      fill={color(p)} stroke="#fff" strokeWidth={active ? 3 : 2} />
                  ) : (
                    <circle cx={cx} cy={cy} r={active ? 10 : 7}
                      fill={color(p)} stroke="#fff" strokeWidth={active ? 3 : 2} />
                  )}
                  {active && (
                    <text x={cx} y={cy - 16} textAnchor="middle" fontSize="15" fontWeight="700" fill="#16283C">
                      {p.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {!loading && !proj && <div className="page-sub" style={{ marginBottom: 0 }}>Inga koordinater att visa.</div>}
      </div>

      <div className="chips" style={{ marginTop: 12, fontSize: 12 }}>
        <span className="badge b-resolved">● Skola</span>
        <span className="badge b-low">■ Spelplats</span>
        <span className="badge b-medium">● Öppet fel</span>
        <span className="badge b-critical">● Öppen incident</span>
      </div>

      {sel && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="li-head">
            <div>
              <div className="li-title">{sel.name}</div>
              <div className="li-meta">
                {sel.kind === 'school' ? 'Skola' : 'Spelplats'}{sel.area ? ` · ${sel.area}` : ''}
                {sel.incidents > 0 ? ` · ${sel.incidents} öppna incidenter` : ''}
                {sel.issues > 0 ? ` · ${sel.issues} öppna fel` : ''}
              </div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setSel(null)}>Stäng</button>
          </div>
          <div className="li-actions">
            <Link className="btn btn-sm btn-primary"
              href={sel.kind === 'school' ? `/schools/${sel.id}` : `/arenas/${sel.id}`}>
              Öppna
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
