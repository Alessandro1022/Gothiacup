'use client';
// Måltider. Prognosen räknar på faktiskt registrerade deltagare, inte på
// lagens anmälda gruppstorlek — den senare stämmer nästan aldrig vid
// ankomst, och det är prognosen som beställningen bygger på.
//
// Specialkost och allergier saknas med flit: hälsodata om minderåriga
// kräver lagringstider och en raderingsrutin, och de byggs i etapp 5.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed, Plus, ScanLine, Check, X, TriangleAlert
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';
import EntitlementsTab from '@/components/meals/EntitlementsTab';

type Hall = {
  id: string; name: string; seats: number | null; supplier: string;
  contact_name: string; contact_phone: string; active: boolean;
};
type Board = {
  service_id: string; hall_id: string; hall_name: string; service_date: string;
  meal: string; opens_at: string; closes_at: string;
  delivered_portions: number | null; served: number | null; wasted: number | null;
  expected: number; checked_in: number; delivery_gap: number | null; notes: string;
};
type Forecast = {
  hall_id: string; hall_name: string; service_date: string; meal: string;
  teams: number; expected: number;
};

const MEALS = ['frukost', 'lunch', 'middag', 'kvall'] as const;
const MEAL_LABEL: Record<string, string> = {
  frukost: 'Frukost', lunch: 'Lunch', middag: 'Middag', kvall: 'Kvällsmål'
};

const today = () => new Date().toISOString().slice(0, 10);

export default function MealsClient() {
  const supabase = createClient();
  const tn = useTenant();
  const canWrite = tn.canWrite('meals');

  const [halls, setHalls] = useState<Hall[]>([]);
  const [board, setBoard] = useState<Board[]>([]);
  const [forecast, setForecast] = useState<Forecast[]>([]);
  const [counts, setCounts] = useState<{ hall_id: string; meal: string; checked_in: number }[]>([]);
  const [tab, setTab] = useState<'avprickning' | 'dagen' | 'rattigheter' | 'matsalar'>('avprickning');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Avprickning
  const [code, setCode] = useState('');
  const [meal, setMeal] = useState<string>('lunch');
  const [hall, setHall] = useState('');
  const [log, setLog] = useState<{ ok: boolean; text: string; at: string }[]>([]);

  // Ny matsal
  const [hName, setHName] = useState('');
  const [hSeats, setHSeats] = useState('');
  const [hSupplier, setHSupplier] = useState('');
  const [hContact, setHContact] = useState('');
  const [hPhone, setHPhone] = useState('');

  const load = useCallback(async () => {
    const [h, b, f, c] = await Promise.all([
      supabase.from('dining_halls').select('*').order('name'),
      supabase.from('meal_board').select('*').eq('service_date', date),
      supabase.from('meal_forecast').select('*').eq('service_date', date),
      // Avprickade även där inget måltidspass är upplagt (del 22)
      supabase.from('meal_checkin_counts').select('hall_id,meal,checked_in').eq('service_date', date)
    ]);
    setCounts((c.data ?? []) as { hall_id: string; meal: string; checked_in: number }[]);
    setHalls((h.data ?? []) as Hall[]);
    setBoard((b.data ?? []) as Board[]);
    setForecast((f.data ?? []) as Forecast[]);
    setLoading(false);
  }, [supabase, date]);

  useEffect(() => { load(); }, [load]);

  const check = async () => {
    const c = code.trim();
    if (!c) return;
    setErr('');
    const { data, error } = await supabase
      .rpc('meal_check', { code: c, m: meal, hall: hall || null })
      .maybeSingle();

    if (error) { setErr(error.message); return; }
    const r = data as { ok: boolean; reason: string; full_name: string | null; team_name: string | null } | null;
    setLog((l) => [{
      ok: !!r?.ok,
      text: `${r?.full_name ?? 'Okänt kort'}${r?.team_name ? ` · ${r.team_name}` : ''} — ${r?.reason ?? 'Fel'}`,
      at: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }, ...l].slice(0, 25));
    setCode('');
    load();
  };

  const addHall = async () => {
    if (!hName.trim()) return;
    setErr('');
    const { error } = await supabase.from('dining_halls').insert({
      name: hName.trim(), seats: hSeats ? parseInt(hSeats) : null,
      supplier: hSupplier.trim(), contact_name: hContact.trim(), contact_phone: hPhone.trim()
    });
    if (error) { setErr(error.message); return; }
    setHName(''); setHSeats(''); setHSupplier(''); setHContact(''); setHPhone(''); load();
  };

  // Skapar passet om det saknas, annars uppdaterar det
  const saveService = async (hallId: string, m: string, patch: Record<string, number | null>) => {
    setErr('');
    const existing = board.find((b) => b.hall_id === hallId && b.meal === m);
    if (existing) {
      const { error } = await supabase.from('meal_services').update(patch).eq('id', existing.service_id);
      if (error) setErr(error.message);
    } else {
      const { error } = await supabase.from('meal_services').insert({
        hall_id: hallId, service_date: date, meal: m,
        opens_at: '07:00', closes_at: '09:00', ...patch
      });
      if (error) setErr(error.message);
    }
    load();
  };

  // Prognos per matsal och måltid för vald dag, även där inget pass finns
  const rows = useMemo(() => {
    const out: { hall_id: string; hall_name: string; meal: string; expected: number; b?: Board }[] = [];
    halls.filter((h) => h.active).forEach((h) => {
      MEALS.forEach((m) => {
        const f = forecast.find((x) => x.hall_id === h.id && x.meal === m);
        const b = board.find((x) => x.hall_id === h.id && x.meal === m);
        if (!f && !b) return;
        out.push({ hall_id: h.id, hall_name: h.name, meal: m, expected: f?.expected ?? 0, b });
      });
    });
    return out;
  }, [halls, forecast, board, date]);

  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);

  if (loading) return <div className="page-sub">Laddar…</div>;

  return (
    <>
      <h1 className="page-title">Måltider</h1>
      <div className="page-sub">
        {halls.filter((h) => h.active).length} matsalar · {totalExpected} portioner {date}
        {!canWrite && ' · du har läsbehörighet'}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'avprickning' ? 'active' : ''}`} onClick={() => setTab('avprickning')}>
          Avprickning
        </button>
        <button className={`tab ${tab === 'dagen' ? 'active' : ''}`} onClick={() => setTab('dagen')}>
          Dagen <span className="mono">{rows.length}</span>
        </button>
        <button className={`tab ${tab === 'rattigheter' ? 'active' : ''}`} onClick={() => setTab('rattigheter')}>
          Rättigheter
        </button>
        <button className={`tab ${tab === 'matsalar' ? 'active' : ''}`} onClick={() => setTab('matsalar')}>
          Matsalar <span className="mono">{halls.length}</span>
        </button>
      </div>

      {tab === 'avprickning' && (
        <>
          <div className="inline-form cols">
            <div style={{ flex: 2 }}>
              <label className="label">Deltagarkod</label>
              <input className="input mono" value={code} autoFocus autoComplete="off"
                onChange={(e) => setCode(e.target.value.trim())}
                onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
                placeholder="Läs av eller skriv koden" />
            </div>
            <div>
              <label className="label">Måltid</label>
              <select className="select" value={meal} onChange={(e) => setMeal(e.target.value)}>
                {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Matsal</label>
              <select className="select" value={hall} onChange={(e) => setHall(e.target.value)}>
                <option value="">Enligt lagets rättighet</option>
                {halls.filter((h) => h.active).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={check} disabled={!code.trim()}>
              <ScanLine size={15} /> Pricka av
            </button>
          </div>

          <div className="list">
            {log.map((l, i) => (
              <div key={i} className="list-item" style={{ padding: '9px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {l.ok
                    ? <Check size={17} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                    : <X size={17} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{l.text}</div>
                    <div className="li-meta" style={{ marginTop: 1 }}>{l.at}</div>
                  </div>
                </div>
              </div>
            ))}
            {log.length === 0 && (
              <div className="page-sub">
                Läs av deltagarens kort. Systemet svarar om personen har rätt till målet
                och prickar av i samma steg.
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'dagen' && (
        <>
          <input className="input" type="date" value={date} style={{ marginBottom: 12, maxWidth: 220 }}
            onChange={(e) => setDate(e.target.value)} />

          <div className="grid-cards">
            {rows.map((r) => {
              const gap = r.b?.delivered_portions != null ? r.b.delivered_portions - r.expected : null;
              return (
                <div key={`${r.hall_id}:${r.meal}`} className="card">
                  <div className="li-head">
                    <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <UtensilsCrossed size={16} /> {MEAL_LABEL[r.meal]}
                    </div>
                    {gap !== null && gap < 0 && (
                      <span className="badge b-critical">{-gap} för få</span>
                    )}
                  </div>
                  <div className="li-meta">{r.hall_name}</div>

                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <span>Behov</span><b>{r.expected}</b>
                  </div>
                  <div className="stat-row">
                    <span>Avprickade</span>
                    <b>{r.b?.checked_in ?? counts.find((x) => x.hall_id === r.hall_id && x.meal === r.meal)?.checked_in ?? 0}</b>
                  </div>

                  {canWrite && (
                    <div className="inline-form cols" style={{ border: 'none', padding: 0, background: 'none', marginTop: 8 }}>
                      <div>
                        <label className="label">Levererat</label>
                        <input className="input" inputMode="numeric" defaultValue={r.b?.delivered_portions ?? ''}
                          onBlur={(e) => saveService(r.hall_id, r.meal, {
                            delivered_portions: e.target.value === '' ? null : parseInt(e.target.value)
                          })} />
                      </div>
                      <div>
                        <label className="label">Serverat</label>
                        <input className="input" inputMode="numeric" defaultValue={r.b?.served ?? ''}
                          onBlur={(e) => saveService(r.hall_id, r.meal, {
                            served: e.target.value === '' ? null : parseInt(e.target.value)
                          })} />
                      </div>
                      <div>
                        <label className="label">Svinn</label>
                        <input className="input" inputMode="numeric" defaultValue={r.b?.wasted ?? ''}
                          onBlur={(e) => saveService(r.hall_id, r.meal, {
                            wasted: e.target.value === '' ? null : parseInt(e.target.value)
                          })} />
                      </div>
                    </div>
                  )}

                  {r.b?.served != null && r.b.served > 0 && r.b.wasted != null && (
                    <div className="li-meta" style={{ marginTop: 6 }}>
                      Svinn {Math.round((r.b.wasted / (r.b.served + r.b.wasted)) * 100)}%
                    </div>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="page-sub">
                Inget planerat den här dagen. Prognosen fylls när lagen fått
                måltidsrättigheter och deltagare är registrerade.
              </div>
            )}
          </div>

          {rows.some((r) => r.b?.delivered_portions != null && r.b.delivered_portions < r.expected) && (
            <div className="form-error" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TriangleAlert size={16} />
              Minst en måltid har färre levererade portioner än behovet. Kontakta leverantören.
            </div>
          )}
        </>
      )}

      {tab === 'rattigheter' && <EntitlementsTab canWrite={canWrite} onChange={load} />}

      {tab === 'matsalar' && (
        <>
          {canWrite && (
            <div className="inline-form cols">
              <div style={{ flex: 2 }}><label className="label">Matsal</label>
                <input className="input" value={hName} onChange={(e) => setHName(e.target.value)} /></div>
              <div><label className="label">Platser</label>
                <input className="input" inputMode="numeric" value={hSeats}
                  onChange={(e) => setHSeats(e.target.value.replace(/\D/g, ''))} /></div>
              <div><label className="label">Leverantör</label>
                <input className="input" value={hSupplier} onChange={(e) => setHSupplier(e.target.value)} /></div>
              <div><label className="label">Kontakt</label>
                <input className="input" value={hContact} onChange={(e) => setHContact(e.target.value)} /></div>
              <div><label className="label">Telefon</label>
                <input className="input" value={hPhone} onChange={(e) => setHPhone(e.target.value)} /></div>
              <button className="btn btn-primary" onClick={addHall} disabled={!hName.trim()}>
                <Plus size={15} /> Lägg till
              </button>
            </div>
          )}

          <div className="grid-cards">
            {halls.map((h) => (
              <div key={h.id} className="card">
                <div className="li-head">
                  <div className="li-title">{h.name}</div>
                  {!h.active && <span className="badge b-low">inaktiv</span>}
                </div>
                <div className="li-meta">
                  {h.seats ? `${h.seats} platser` : 'platser ej angivna'}
                  {h.supplier ? ` · ${h.supplier}` : ''}
                </div>
                {h.contact_name && (
                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <span>{h.contact_name}</span><b>{h.contact_phone || '—'}</b>
                  </div>
                )}
              </div>
            ))}
            {halls.length === 0 && <div className="page-sub">Inga matsalar registrerade.</div>}
          </div>
        </>
      )}
    </>
  );
}
