'use client';
// Administration av grundstrukturen: områden, skolor, spelplatser.
// Här rättas också koordinater som flaggats som felaktiga vid import.
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Area = { id: string; name: string };
type School = {
  id: string; name: string; address: string | null; capacity: number; area_id: string | null;
  lat: number | null; lng: number | null; coord_raw: string | null; coord_flagged: boolean;
};
type Arena = {
  id: string; name: string; address: string | null; surface_count: number; area_id: string | null;
  lat: number | null; lng: number | null; club: string | null; contact_name: string | null; contact_phone: string | null;
};

type Tab = 'schools' | 'arenas' | 'areas' | 'coords';

export default function StructureClient() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('schools');
  const [areas, setAreas] = useState<Area[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // Redigering
  const [editId, setEditId] = useState<string | null>(null);
  const [fName, setFName] = useState(''); const [fAddr, setFAddr] = useState('');
  const [fArea, setFArea] = useState(''); const [fCap, setFCap] = useState('');
  const [fLat, setFLat] = useState(''); const [fLng, setFLng] = useState('');
  const [fClub, setFClub] = useState(''); const [fContact, setFContact] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [newArea, setNewArea] = useState('');

  const load = useCallback(async () => {
    const [{ data: a }, { data: s }, { data: ar }] = await Promise.all([
      supabase.from('areas').select('id,name').order('name'),
      supabase.from('schools').select('id,name,address,capacity,area_id,lat,lng,coord_raw,coord_flagged').order('name'),
      supabase.from('arenas').select('id,name,address,surface_count,area_id,lat,lng,club,contact_name,contact_phone').order('name')
    ]);
    setAreas((a ?? []) as Area[]);
    setSchools((s ?? []) as School[]);
    setArenas((ar ?? []) as Arena[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setEditId(null); setFName(''); setFAddr(''); setFArea(''); setFCap('');
    setFLat(''); setFLng(''); setFClub(''); setFContact(''); setFPhone('');
  };

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? '—';
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  // ---- Skolor ----
  const editSchool = (s: School) => {
    setEditId(s.id); setFName(s.name); setFAddr(s.address ?? '');
    setFArea(s.area_id ?? ''); setFCap(String(s.capacity));
    setFLat(s.lat === null ? '' : String(s.lat)); setFLng(s.lng === null ? '' : String(s.lng));
  };
  const saveSchool = async () => {
    setErr('');
    const lat = num(fLat), lng = num(fLng);
    const payload = {
      name: fName, address: fAddr || null, area_id: fArea || null,
      capacity: parseInt(fCap) || 0, lat, lng,
      coord_flagged: lat !== null && lng !== null ? false : undefined
    };
    const { error } = editId
      ? await supabase.from('schools').update(payload).eq('id', editId)
      : await supabase.from('schools').insert(payload);
    if (error) { setErr(error.message); return; }
    reset(); load();
  };
  const removeSchool = async (id: string) => {
    if (!confirm('Radera? Detta går inte att ångra.')) return;
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) setErr(error.message);
    load();
  };

  // ---- Spelplatser ----
  const editArena = (a: Arena) => {
    setEditId(a.id); setFName(a.name); setFAddr(a.address ?? '');
    setFArea(a.area_id ?? ''); setFCap(String(a.surface_count));
    setFLat(a.lat === null ? '' : String(a.lat)); setFLng(a.lng === null ? '' : String(a.lng));
    setFClub(a.club ?? ''); setFContact(a.contact_name ?? ''); setFPhone(a.contact_phone ?? '');
  };
  const saveArena = async () => {
    setErr('');
    const payload = {
      name: fName, address: fAddr || null, area_id: fArea || null,
      surface_count: parseInt(fCap) || 1, lat: num(fLat), lng: num(fLng),
      club: fClub || null, contact_name: fContact || null, contact_phone: fPhone || null
    };
    const { error } = editId
      ? await supabase.from('arenas').update(payload).eq('id', editId)
      : await supabase.from('arenas').insert(payload);
    if (error) { setErr(error.message); return; }
    reset(); load();
  };
  const removeArena = async (id: string) => {
    if (!confirm('Radera? Detta går inte att ångra.')) return;
    const { error } = await supabase.from('arenas').delete().eq('id', id);
    if (error) setErr(error.message);
    load();
  };

  // ---- Områden ----
  const addArea = async () => {
    if (!newArea.trim()) return;
    const { error } = await supabase.from('areas').insert({ name: newArea.trim() });
    if (error) setErr(error.message);
    setNewArea(''); load();
  };
  const removeArea = async (id: string) => {
    if (!confirm('Radera området? Skolor och planer blir utan område.')) return;
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) setErr(error.message);
    load();
  };

  // ---- Koordinaträttning ----
  const fixCoord = async (s: School, lat: string, lng: string) => {
    const la = num(lat), lo = num(lng);
    if (la === null || lo === null) return;
    const { error } = await supabase.from('schools')
      .update({ lat: la, lng: lo, coord_flagged: false }).eq('id', s.id);
    if (error) setErr(error.message);
    load();
  };

  const flagged = schools.filter((s) => s.coord_flagged);
  const noCoord = schools.filter((s) => !s.coord_flagged && s.lat === null);
  const match = (t: string) => t.toLowerCase().includes(q.toLowerCase());

  return (
    <>
      <h1 className="page-title">Struktur</h1>
      <div className="page-sub">
        {areas.length} områden · {schools.length} skolor · {arenas.length} spelplatser
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'schools' ? 'active' : ''}`} onClick={() => { setTab('schools'); reset(); }}>Skolor</button>
        <button className={`tab ${tab === 'arenas' ? 'active' : ''}`} onClick={() => { setTab('arenas'); reset(); }}>Spelplatser</button>
        <button className={`tab ${tab === 'areas' ? 'active' : ''}`} onClick={() => { setTab('areas'); reset(); }}>Områden</button>
        <button className={`tab ${tab === 'coords' ? 'active' : ''}`} onClick={() => { setTab('coords'); reset(); }}>
          Koordinater {flagged.length > 0 && <span className="badge b-critical" style={{ marginLeft: 6 }}>{flagged.length}</span>}
        </button>
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
      {loading && <div className="page-sub">Laddar…</div>}

      {/* ---------- SKOLOR ---------- */}
      {tab === 'schools' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">Namn</label><input className="input" value={fName} onChange={(e) => setFName(e.target.value)} /></div>
            <div><label className="label">Adress</label><input className="input" value={fAddr} onChange={(e) => setFAddr(e.target.value)} /></div>
            <div><label className="label">Område</label>
              <select className="select" value={fArea} onChange={(e) => setFArea(e.target.value)}>
                <option value="">Inget</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="label">Kapacitet</label><input className="input" type="number" value={fCap} onChange={(e) => setFCap(e.target.value)} /></div>
            <div><label className="label">Latitud</label><input className="input" value={fLat} onChange={(e) => setFLat(e.target.value)} placeholder="57.700667" /></div>
            <div><label className="label">Longitud</label><input className="input" value={fLng} onChange={(e) => setFLng(e.target.value)} placeholder="11.986500" /></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary" onClick={saveSchool} disabled={!fName}>{editId ? 'Spara' : 'Lägg till'}</button>
              {editId && <button className="btn" onClick={reset}>Avbryt</button>}
            </div>
          </div>

          <input className="input" style={{ marginBottom: 10 }} placeholder="Sök…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="list">
            {schools.filter((s) => match(s.name)).map((s) => (
              <div key={s.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{s.name}</div>
                    <div className="li-meta">
                      {areaName(s.area_id)}{s.address ? ` · ${s.address}` : ''}
                      {s.capacity ? ` · ${s.capacity} platser` : ''}
                    </div>
                  </div>
                  {s.coord_flagged
                    ? <span className="badge b-critical">Felaktig koordinat</span>
                    : s.lat === null
                      ? <span className="badge b-medium">Saknar koordinat</span>
                      : <span className="badge b-resolved">På kartan</span>}
                </div>
                <div className="li-actions">
                  <button className="btn btn-sm" onClick={() => editSchool(s)}>Redigera</button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeSchool(s.id)}>Radera</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------- SPELPLATSER ---------- */}
      {tab === 'arenas' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">Namn</label><input className="input" value={fName} onChange={(e) => setFName(e.target.value)} /></div>
            <div><label className="label">Område</label>
              <select className="select" value={fArea} onChange={(e) => setFArea(e.target.value)}>
                <option value="">Inget</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="label">Antal planer</label><input className="input" type="number" value={fCap} onChange={(e) => setFCap(e.target.value)} /></div>
            <div><label className="label">Förening</label><input className="input" value={fClub} onChange={(e) => setFClub(e.target.value)} /></div>
            <div><label className="label">Ansvarig</label><input className="input" value={fContact} onChange={(e) => setFContact(e.target.value)} /></div>
            <div><label className="label">Telefon</label><input className="input" value={fPhone} onChange={(e) => setFPhone(e.target.value)} /></div>
            <div><label className="label">Latitud</label><input className="input" value={fLat} onChange={(e) => setFLat(e.target.value)} /></div>
            <div><label className="label">Longitud</label><input className="input" value={fLng} onChange={(e) => setFLng(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary" onClick={saveArena} disabled={!fName}>{editId ? 'Spara' : 'Lägg till'}</button>
              {editId && <button className="btn" onClick={reset}>Avbryt</button>}
            </div>
          </div>

          <input className="input" style={{ marginBottom: 10 }} placeholder="Sök…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="list">
            {arenas.filter((a) => match(a.name)).map((a) => (
              <div key={a.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{a.name}</div>
                    <div className="li-meta">
                      {areaName(a.area_id)}{a.club ? ` · ${a.club}` : ''}
                      {a.contact_name ? ` · ${a.contact_name}` : ''}
                    </div>
                  </div>
                  {a.lat === null
                    ? <span className="badge b-medium">Saknar koordinat</span>
                    : <span className="badge b-resolved">På kartan</span>}
                </div>
                <div className="li-actions">
                  <button className="btn btn-sm" onClick={() => editArena(a)}>Redigera</button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeArena(a.id)}>Radera</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------- OMRÅDEN ---------- */}
      {tab === 'areas' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">Nytt område</label><input className="input" value={newArea} onChange={(e) => setNewArea(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addArea} disabled={!newArea.trim()}>Lägg till</button>
          </div>
          <div className="list">
            {areas.map((a) => {
              const ns = schools.filter((s) => s.area_id === a.id).length;
              const na = arenas.filter((x) => x.area_id === a.id).length;
              return (
                <div key={a.id} className="list-item">
                  <div className="li-head">
                    <div>
                      <div className="li-title">{a.name}</div>
                      <div className="li-meta">{ns} skolor · {na} spelplatser</div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => removeArea(a.id)}>Radera</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------- KOORDINATER ---------- */}
      {tab === 'coords' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="li-title">Kvalitetskontroll av koordinater</div>
            <div className="li-meta">
              {flagged.length} koordinater i underlaget är ogiltiga (minuttalet är 60 eller högre och kan
              därför inte vara en riktig position). {noCoord.length} platser saknar koordinat helt.
              Rätta nedan så hamnar de på kartan direkt.
            </div>
          </div>

          {flagged.map((s) => (
            <CoordFix key={s.id} school={s} onSave={fixCoord} />
          ))}

          {noCoord.length > 0 && (
            <>
              <h2 style={{ fontSize: 15, margin: '18px 0 8px' }}>Saknar koordinat</h2>
              <div className="list">
                {noCoord.map((s) => <CoordFix key={s.id} school={s} onSave={fixCoord} />)}
              </div>
            </>
          )}

          {flagged.length === 0 && noCoord.length === 0 && (
            <div className="page-sub">Alla platser har giltiga koordinater.</div>
          )}
        </>
      )}
    </>
  );
}

function CoordFix({ school, onSave }: {
  school: School;
  onSave: (s: School, lat: string, lng: string) => void;
}) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  return (
    <div className="list-item" style={{ marginBottom: 8 }}>
      <div className="li-head">
        <div>
          <div className="li-title">{school.name}</div>
          {school.coord_raw && <div className="li-meta mono">I underlaget: {school.coord_raw}</div>}
        </div>
        {school.coord_flagged
          ? <span className="badge b-critical">Ogiltig</span>
          : <span className="badge b-medium">Saknas</span>}
      </div>
      <div className="inline-form cols" style={{ marginTop: 10, marginBottom: 0 }}>
        <div><label className="label">Latitud</label>
          <input className="input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="57.700667" /></div>
        <div><label className="label">Longitud</label>
          <input className="input" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="11.986500" /></div>
        <button className="btn btn-primary" onClick={() => onSave(school, lat, lng)} disabled={!lat || !lng}>Spara</button>
      </div>
    </div>
  );
}
