'use client';
// Transport och logistik. Ett uppdrag som kvitteras som levererat bokar om
// materielen i lagret automatiskt — personalen ska inte behöva registrera
// samma leverans två gånger, för då blir den andra gången inte av.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Truck, Plus, Check, Clock, AlertTriangle, Package, X
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';

type Job = {
  id: string; title: string; kind: string; status: string; urgent: boolean;
  scheduled_at: string | null; people: number | null; distance_km: number | null;
  delay_reason: string; delivered_at: string | null; confirm_code: string; note: string;
  vehicle_label: string | null; driver_name: string | null; driver_phone: string | null;
  from_name: string | null; to_name: string | null; item_count: number;
};
type Vehicle = {
  id: string; label: string; kind: string; plate: string; seats: number | null;
  driver_name: string; driver_phone: string; active: boolean;
};
type Place = { id: string; name: string; kind: 'school' | 'arena' };
type Item = { item_id: string; name: string; unit: string };

const STATUS: Record<string, string> = {
  planerad: 'Planerad', tilldelad: 'Tilldelad', pagar: 'Pågår',
  levererad: 'Levererad', forsenad: 'Försenad', installd: 'Inställd'
};
const KIND: Record<string, string> = {
  lag: 'Lag', personal: 'Personal', materiel: 'Materiel', mat: 'Mat', annat: 'Annat'
};
const VEHICLE_KIND = ['skapbil', 'buss', 'lastbil', 'personbil', 'annat'];

export default function TransportClient() {
  const supabase = createClient();
  const tn = useTenant();
  const canWrite = tn.canWrite('transport');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<'jobb' | 'fordon'>('jobb');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [newJob, setNewJob] = useState(false);

  // Nytt uppdrag
  const [jTitle, setJTitle] = useState('');
  const [jKind, setJKind] = useState('materiel');
  const [jFrom, setJFrom] = useState('');
  const [jTo, setJTo] = useState('');
  const [jWhen, setJWhen] = useState('');
  const [jVehicle, setJVehicle] = useState('');
  const [jPeople, setJPeople] = useState('');
  const [jUrgent, setJUrgent] = useState(false);
  const [jItems, setJItems] = useState<{ item_id: string; qty: string }[]>([]);

  // Nytt fordon
  const [vLabel, setVLabel] = useState('');
  const [vKind, setVKind] = useState('skapbil');
  const [vPlate, setVPlate] = useState('');
  const [vSeats, setVSeats] = useState('');
  const [vDriver, setVDriver] = useState('');
  const [vPhone, setVPhone] = useState('');

  const load = useCallback(async () => {
    const [j, v, s, a, i] = await Promise.all([
      supabase.from('transport_board').select('*').order('scheduled_at', { nullsFirst: false }),
      supabase.from('vehicles').select('*').order('label'),
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('arenas').select('id,name').order('name'),
      supabase.from('stock_totals').select('item_id,name,unit').order('name')
    ]);
    setJobs((j.data ?? []) as Job[]);
    setVehicles((v.data ?? []) as Vehicle[]);
    setPlaces([
      ...((s.data ?? []) as { id: string; name: string }[]).map((x) => ({ ...x, kind: 'school' as const })),
      ...((a.data ?? []) as { id: string; name: string }[]).map((x) => ({ ...x, kind: 'arena' as const }))
    ]);
    setItems((i.data ?? []) as Item[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel('transport-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_jobs' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parse = (v: string) => (v === '' ? { t: null, i: null } : { t: v.split(':')[0], i: v.split(':')[1] });

  const createJob = async () => {
    if (!jTitle.trim()) { setErr('Uppdraget behöver en rubrik.'); return; }
    setErr('');
    const from = parse(jFrom), to = parse(jTo);
    const { data: u } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('transport_jobs').insert({
      title: jTitle.trim(), kind: jKind, urgent: jUrgent,
      from_location_type: from.t, from_location_id: from.i,
      to_location_type: to.t, to_location_id: to.i,
      scheduled_at: jWhen ? new Date(jWhen).toISOString() : null,
      vehicle_id: jVehicle || null,
      status: jVehicle ? 'tilldelad' : 'planerad',
      people: jPeople ? parseInt(jPeople) : null,
      created_by: u?.user?.id ?? null
    }).select('id').single();

    if (error) { setErr(error.message); return; }

    const rows = jItems
      .filter((r) => r.item_id && parseInt(r.qty) > 0)
      .map((r) => ({ job_id: data.id, item_id: r.item_id, qty: parseInt(r.qty) }));
    if (rows.length) {
      const { error: e2 } = await supabase.from('transport_job_items').insert(rows);
      if (e2) { setErr(e2.message); return; }
    }

    setJTitle(''); setJWhen(''); setJPeople(''); setJItems([]); setJUrgent(false);
    setNewJob(false); load();
  };

  const setStatus = async (j: Job, status: string) => {
    setErr('');
    let delay_reason = j.delay_reason;
    if (status === 'forsenad') {
      const r = prompt('Varför är den försenad?', j.delay_reason);
      if (r === null) return;
      delay_reason = r;
    }
    const { error } = await supabase.from('transport_jobs')
      .update({ status, delay_reason }).eq('id', j.id);
    if (error) setErr(error.message); else load();
  };

  const addVehicle = async () => {
    if (!vLabel.trim()) return;
    setErr('');
    const { error } = await supabase.from('vehicles').insert({
      label: vLabel.trim(), kind: vKind, plate: vPlate.trim(),
      seats: vSeats ? parseInt(vSeats) : null,
      driver_name: vDriver.trim(), driver_phone: vPhone.trim()
    });
    if (error) { setErr(error.message); return; }
    setVLabel(''); setVPlate(''); setVSeats(''); setVDriver(''); setVPhone(''); load();
  };

  const visible = useMemo(
    () => jobs.filter((j) => filter === '' || j.status === filter),
    [jobs, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    jobs.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, [jobs]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('sv-SE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div className="page-sub">Laddar…</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title">Transport</h1>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {jobs.length} uppdrag · {vehicles.filter((v) => v.active).length} fordon
            {!canWrite && ' · du har läsbehörighet'}
          </div>
        </div>
        {canWrite && tab === 'jobb' && (
          <button className="btn btn-primary" onClick={() => setNewJob(true)}>
            <Plus size={16} /> Nytt uppdrag
          </button>
        )}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="tabs" style={{ marginTop: 12 }}>
        <button className={`tab ${tab === 'jobb' ? 'active' : ''}`} onClick={() => setTab('jobb')}>
          Uppdrag <span className="mono">{jobs.length}</span>
        </button>
        <button className={`tab ${tab === 'fordon' ? 'active' : ''}`} onClick={() => setTab('fordon')}>
          Fordon <span className="mono">{vehicles.length}</span>
        </button>
      </div>

      {tab === 'jobb' && (
        <>
          <div className="chips">
            <button className={`chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>Alla</button>
            {Object.entries(STATUS).map(([k, v]) => (
              <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
                {v} {counts[k] ? `(${counts[k]})` : ''}
              </button>
            ))}
          </div>

          <div className="list">
            {visible.map((j) => (
              <div key={j.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {j.urgent && <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />}
                      {j.title}
                    </div>
                    <div className="li-meta">
                      {KIND[j.kind] ?? j.kind} · {j.from_name} → {j.to_name} · {fmt(j.scheduled_at)}
                      {j.vehicle_label ? ` · ${j.vehicle_label}` : ''}
                      {j.driver_name ? ` · ${j.driver_name}` : ''}
                      {j.item_count > 0 ? ` · ${j.item_count} poster` : ''}
                      {j.people ? ` · ${j.people} pers` : ''}
                    </div>
                    {j.delay_reason && (
                      <div className="li-meta" style={{ color: 'var(--danger)' }}>
                        Försening: {j.delay_reason}
                      </div>
                    )}
                  </div>
                  <span className={`badge ${j.status === 'levererad' ? 'b-resolved' : j.status === 'forsenad' || j.status === 'installd' ? 'b-critical' : 'b-low'}`}>
                    {STATUS[j.status] ?? j.status}
                  </span>
                </div>

                {canWrite && j.status !== 'levererad' && (
                  <div className="li-actions">
                    {j.status !== 'pagar' && (
                      <button className="btn btn-sm" onClick={() => setStatus(j, 'pagar')}>
                        <Clock size={13} /> Påbörja
                      </button>
                    )}
                    <button className="btn btn-sm btn-primary" onClick={() => setStatus(j, 'levererad')}>
                      <Check size={13} /> Levererad
                    </button>
                    <button className="btn btn-sm" onClick={() => setStatus(j, 'forsenad')}>Försenad</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setStatus(j, 'installd')}>
                      <X size={13} />
                    </button>
                    <span className="li-meta mono" style={{ marginTop: 0 }}>kod {j.confirm_code}</span>
                  </div>
                )}

                {j.status === 'levererad' && j.item_count > 0 && (
                  <div className="li-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={13} /> Materielen är ombokad i lagret
                  </div>
                )}
              </div>
            ))}
            {visible.length === 0 && <div className="page-sub">Inga uppdrag här.</div>}
          </div>
        </>
      )}

      {tab === 'fordon' && (
        <>
          {canWrite && (
            <div className="inline-form cols">
              <div><label className="label">Beteckning</label>
                <input className="input" value={vLabel} onChange={(e) => setVLabel(e.target.value)} placeholder="Skåpbil A" /></div>
              <div><label className="label">Typ</label>
                <select className="select" value={vKind} onChange={(e) => setVKind(e.target.value)}>
                  {VEHICLE_KIND.map((k) => <option key={k} value={k}>{k}</option>)}
                </select></div>
              <div><label className="label">Reg.nr</label>
                <input className="input" value={vPlate} onChange={(e) => setVPlate(e.target.value)} /></div>
              <div><label className="label">Platser</label>
                <input className="input" inputMode="numeric" value={vSeats}
                  onChange={(e) => setVSeats(e.target.value.replace(/\D/g, ''))} /></div>
              <div><label className="label">Chaufför</label>
                <input className="input" value={vDriver} onChange={(e) => setVDriver(e.target.value)} /></div>
              <div><label className="label">Telefon</label>
                <input className="input" value={vPhone} onChange={(e) => setVPhone(e.target.value)} /></div>
              <button className="btn btn-primary" onClick={addVehicle} disabled={!vLabel.trim()}>
                <Plus size={15} /> Lägg till
              </button>
            </div>
          )}

          <div className="grid-cards">
            {vehicles.map((v) => (
              <div key={v.id} className="card">
                <div className="li-head">
                  <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Truck size={16} /> {v.label}
                  </div>
                  {!v.active && <span className="badge b-low">inaktiv</span>}
                </div>
                <div className="li-meta">
                  {v.kind}{v.plate ? ` · ${v.plate}` : ''}{v.seats ? ` · ${v.seats} platser` : ''}
                </div>
                {v.driver_name && (
                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <span>{v.driver_name}</span><b>{v.driver_phone || '—'}</b>
                  </div>
                )}
                <div className="stat-row">
                  <span>Uppdrag idag</span>
                  <b>{jobs.filter((j) => j.vehicle_label === v.label && j.status !== 'levererad').length}</b>
                </div>
              </div>
            ))}
            {vehicles.length === 0 && <div className="page-sub">Inga fordon registrerade.</div>}
          </div>
        </>
      )}

      {newJob && (
        <div className="modal-overlay" onClick={() => setNewJob(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3>Nytt transportuppdrag</h3>

            <label className="label">Rubrik</label>
            <input className="input" value={jTitle} onChange={(e) => setJTitle(e.target.value)}
              placeholder="Madrasser till Katrinelundsgymnasiet" />

            <div className="inline-form cols" style={{ border: 'none', padding: 0, background: 'none', marginTop: 4 }}>
              <div><label className="label">Typ</label>
                <select className="select" value={jKind} onChange={(e) => setJKind(e.target.value)}>
                  {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="label">Från</label>
                <select className="select" value={jFrom} onChange={(e) => setJFrom(e.target.value)}>
                  <option value="">Centrallager</option>
                  {places.map((p) => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name}</option>)}
                </select></div>
              <div><label className="label">Till</label>
                <select className="select" value={jTo} onChange={(e) => setJTo(e.target.value)}>
                  <option value="">Centrallager</option>
                  {places.map((p) => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name}</option>)}
                </select></div>
              <div><label className="label">När</label>
                <input className="input" type="datetime-local" value={jWhen}
                  onChange={(e) => setJWhen(e.target.value)} /></div>
              <div><label className="label">Fordon</label>
                <select className="select" value={jVehicle} onChange={(e) => setJVehicle(e.target.value)}>
                  <option value="">Ej tilldelat</option>
                  {vehicles.filter((v) => v.active).map((v) => (
                    <option key={v.id} value={v.id}>{v.label}{v.driver_name ? ` · ${v.driver_name}` : ''}</option>
                  ))}
                </select></div>
              {(jKind === 'lag' || jKind === 'personal') && (
                <div><label className="label">Antal personer</label>
                  <input className="input" inputMode="numeric" value={jPeople}
                    onChange={(e) => setJPeople(e.target.value.replace(/\D/g, ''))} /></div>
              )}
            </div>

            <label className="check-row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={jUrgent} onChange={() => setJUrgent(!jUrgent)} />
              Akut
            </label>

            {items.length > 0 && (
              <>
                <label className="label" style={{ marginTop: 12 }}>
                  Materiel · bokas om i lagret när uppdraget kvitteras
                </label>
                {jItems.map((r, idx) => (
                  <div key={idx} className="inline-form cols" style={{ border: 'none', padding: 0, background: 'none', marginTop: 0 }}>
                    <div style={{ flex: 2 }}>
                      <select className="select" value={r.item_id}
                        onChange={(e) => setJItems(jItems.map((x, k) => k === idx ? { ...x, item_id: e.target.value } : x))}>
                        <option value="">Välj artikel…</option>
                        {items.map((it) => <option key={it.item_id} value={it.item_id}>{it.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <input className="input" inputMode="numeric" placeholder="Antal" value={r.qty}
                        onChange={(e) => setJItems(jItems.map((x, k) => k === idx ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x))} />
                    </div>
                    <button className="btn btn-sm btn-danger"
                      onClick={() => setJItems(jItems.filter((_, k) => k !== idx))}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button className="btn btn-sm" style={{ marginTop: 6 }}
                  onClick={() => setJItems([...jItems, { item_id: '', qty: '' }])}>
                  <Plus size={13} /> Lägg till post
                </button>
              </>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={() => setNewJob(false)}>Avbryt</button>
              <button className="btn btn-primary" onClick={createJob} disabled={!jTitle.trim()}>Skapa</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
