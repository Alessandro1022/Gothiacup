'use client';
// Bemanning: brister, jour, frånvaro, tillgänglighet och introduktion.
//
// Frånvaro visas bara för personen själv och för ledningen. Att en kollega
// kan se vem som är sjukskriven är inte en driftfråga, och tabellen har
// därför heller ingen plats för orsak — bara att någon inte kommer.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TriangleAlert, CalendarOff, CalendarCheck, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { tierOf, type Role, ROLE_LABELS } from '@/lib/types';
import OnCallTab from '@/components/staffing/OnCallTab';
import IntroTab, { appliesTo } from '@/components/staffing/IntroTab';
import ChecklistAdmin from '@/components/checklists/ChecklistAdmin';

type Gap = {
  shift_id: string; starts_at: string; ends_at: string; role_note: string | null;
  location_name: string; assigned_name: string | null; gap_kind: string;
};
type Absence = {
  id: string; user_id: string; kind: string; from_date: string; to_date: string;
  replacement_user_id: string | null;
};
type Person = { id: string; full_name: string; role: Role };
type Avail = { id: string; user_id: string; day: string; kind: string; note: string };

export type StaffingTab = 'brister' | 'jour' | 'franvaro' | 'tillganglighet' | 'intro' | 'checklistor';

const GAP_LABEL: Record<string, string> = {
  obemannat: 'Obemannat',
  'franvarande utan ersattare': 'Frånvarande utan ersättare',
  'ej incheckad': 'Ej incheckad'
};
const ABSENCE_LABEL: Record<string, string> = {
  sjuk: 'Sjuk', vab: 'Vård av barn', ledig: 'Ledig', annat: 'Annat'
};
const AVAIL_LABEL: Record<string, string> = {
  tillganglig: 'kan jobba', onskar: 'önskar pass', kan_inte: 'kan inte'
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function StaffingClient({ userId, role, initialTab }: {
  userId: string; role: Role; initialTab?: StaffingTab;
}) {
  const supabase = useMemo(() => createClient(), []);
  const tier = tierOf(role);
  const isManager = tier >= 4;

  const [tab, setTab] = useState<StaffingTab>(
    initialTab && ((initialTab !== 'brister' && initialTab !== 'checklistor') || isManager)
      ? initialTab : (isManager ? 'brister' : 'jour')
  );
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [avail, setAvail] = useState<Avail[]>([]);
  const [introLeft, setIntroLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [availView, setAvailView] = useState<'egen' | 'alla'>('egen');

  // Ny frånvaro
  const [aUser, setAUser] = useState('');
  const [aKind, setAKind] = useState('sjuk');
  const [aFrom, setAFrom] = useState('');
  const [aTo, setATo] = useState('');

  // Ny tillgänglighet
  const [vDay, setVDay] = useState('');
  const [vKind, setVKind] = useState('tillganglig');
  const [vNote, setVNote] = useState('');

  const load = useCallback(async () => {
    const [g, a, p, v, i, d] = await Promise.all([
      isManager ? supabase.from('staffing_gaps').select('*').order('starts_at')
                : Promise.resolve({ data: [] }),
      supabase.from('absences').select('*').order('from_date', { ascending: false }),
      supabase.from('profiles').select('id,full_name,role').order('full_name'),
      // Ledningen ser allas tillgänglighet (RLS), övriga bara sin egen
      supabase.from('availability').select('id,user_id,day,kind,note').gte('day', todayIso()).order('day'),
      supabase.from('onboarding_items').select('id,roles,required'),
      supabase.from('onboarding_done').select('item_id').eq('user_id', userId)
    ]);
    setGaps((g.data ?? []) as Gap[]);
    setAbsences((a.data ?? []) as Absence[]);
    setPeople((p.data ?? []) as Person[]);
    setAvail((v.data ?? []) as Avail[]);
    const doneSet = new Set(((d.data ?? []) as { item_id: string }[]).map((x) => x.item_id));
    const items = (i.data ?? []) as { id: string; roles: string[] | null; required: boolean }[];
    setIntroLeft(items.filter((it) => it.required && appliesTo(it, role) && !doneSet.has(it.id)).length);
    setLoading(false);
  }, [supabase, userId, isManager, role]);

  useEffect(() => { load(); }, [load]);

  // Fliken man länkats till kan ligga utanför skärmen på en telefon
  useEffect(() => {
    if (loading) return;
    document.querySelector('.tabs .tab.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [tab, loading]);

  const addAbsence = async () => {
    const who = isManager ? (aUser || userId) : userId;
    if (!aFrom || !aTo) { setErr('Välj datum.'); return; }
    if (aTo < aFrom) { setErr('Slutdatum kan inte vara före startdatum.'); return; }
    setErr('');
    const { error } = await supabase.from('absences').insert({
      user_id: who, kind: aKind, from_date: aFrom, to_date: aTo, reported_by: userId
    });
    if (error) { setErr(error.message); return; }
    setAFrom(''); setATo(''); load();
  };

  const setReplacement = async (a: Absence, uid: string) => {
    await supabase.from('absences').update({ replacement_user_id: uid || null }).eq('id', a.id);
    load();
  };

  const addAvail = async () => {
    if (!vDay) return;
    setErr('');
    const { error } = await supabase.from('availability').insert({
      user_id: userId, day: vDay, kind: vKind, note: vNote.trim()
    });
    if (error) {
      setErr(/duplicate|unique/i.test(error.message) ? 'Du har redan anmält det för den dagen.' : error.message);
      return;
    }
    setVDay(''); setVNote(''); load();
  };

  const removeAvail = async (v: Avail) => {
    await supabase.from('availability').delete().eq('id', v.id);
    load();
  };

  const name = (id: string | null) =>
    id ? (people.find((p) => p.id === id)?.full_name || '—') : '—';
  const fmt = (d: string) =>
    new Date(d).toLocaleString('sv-SE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const dayLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  const mine = avail.filter((v) => v.user_id === userId);

  // Ledningens översikt: per dag, vilka kan och vilka vill
  const byDay = useMemo(() => {
    const m = new Map<string, Avail[]>();
    for (const v of avail) m.set(v.day, [...(m.get(v.day) ?? []), v]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [avail]);

  if (loading) return <div className="page-sub">Laddar…</div>;

  return (
    <>
      <h1 className="page-title">Bemanning</h1>
      <div className="page-sub">
        {isManager ? `${gaps.length} brister · ` : ''}
        {introLeft > 0 ? `${introLeft} punkter kvar i introduktionen` : 'introduktionen klar'}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="tabs">
        {isManager && (
          <button className={`tab ${tab === 'brister' ? 'active' : ''}`} onClick={() => setTab('brister')}>
            Brister <span className="mono">{gaps.length}</span>
          </button>
        )}
        <button className={`tab ${tab === 'jour' ? 'active' : ''}`} onClick={() => setTab('jour')}>Jour</button>
        <button className={`tab ${tab === 'franvaro' ? 'active' : ''}`} onClick={() => setTab('franvaro')}>Frånvaro</button>
        <button className={`tab ${tab === 'tillganglighet' ? 'active' : ''}`} onClick={() => setTab('tillganglighet')}>
          Tillgänglighet
        </button>
        <button className={`tab ${tab === 'intro' ? 'active' : ''}`} onClick={() => setTab('intro')}>
          Introduktion {introLeft > 0 && <span className="mono">{introLeft}</span>}
        </button>
        {isManager && (
          <button className={`tab ${tab === 'checklistor' ? 'active' : ''}`} onClick={() => setTab('checklistor')}>
            Checklistor
          </button>
        )}
      </div>

      {tab === 'brister' && isManager && (
        <div className="list">
          {gaps.map((g) => (
            <div key={g.shift_id} className="list-item">
              <div className="li-head">
                <div>
                  <div className="li-title">{g.role_note || 'Pass'}</div>
                  <div className="li-meta">
                    {fmt(g.starts_at)} · {g.location_name}
                    {g.assigned_name ? ` · ${g.assigned_name}` : ''}
                  </div>
                </div>
                <span className="badge b-critical">
                  <TriangleAlert size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                  {GAP_LABEL[g.gap_kind] ?? g.gap_kind}
                </span>
              </div>
            </div>
          ))}
          {gaps.length === 0 && (
            <div className="page-sub">Inga brister. Alla pass är bemannade och incheckade.</div>
          )}
        </div>
      )}

      {tab === 'jour' && <OnCallTab isManager={isManager} />}

      {tab === 'franvaro' && (
        <>
          <div className="inline-form cols">
            {isManager && (
              <div style={{ flex: 2 }}>
                <label className="label">Person</label>
                <select className="select" value={aUser} onChange={(e) => setAUser(e.target.value)}>
                  <option value="">Jag själv</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || '—'} · {ROLE_LABELS[p.role]}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Typ</label>
              <select className="select" value={aKind} onChange={(e) => setAKind(e.target.value)}>
                {Object.entries(ABSENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Från</label>
              <input className="input" type="date" value={aFrom} onChange={(e) => setAFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Till</label>
              <input className="input" type="date" value={aTo} onChange={(e) => setATo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={addAbsence}>
              <CalendarOff size={15} /> Anmäl
            </button>
          </div>

          <div className="page-sub" style={{ marginTop: -4, marginBottom: 10 }}>
            Ingen orsak registreras — bara att någon inte kommer. Raden syns för
            personen själv och för ledningen, inte för kollegorna.
          </div>

          <div className="list">
            {absences.map((a) => (
              <div key={a.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{name(a.user_id)}</div>
                    <div className="li-meta">
                      {ABSENCE_LABEL[a.kind] ?? a.kind} · {a.from_date} till {a.to_date}
                    </div>
                  </div>
                  {!a.replacement_user_id
                    ? <span className="badge b-critical">ersättare saknas</span>
                    : <span className="badge b-resolved">ersätts av {name(a.replacement_user_id)}</span>}
                </div>
                {isManager && (
                  <div className="li-actions">
                    <select className="select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                      value={a.replacement_user_id ?? ''}
                      onChange={(e) => setReplacement(a, e.target.value)}>
                      <option value="">Ersättare: ingen</option>
                      {people.filter((p) => p.id !== a.user_id).map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || '—'}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
            {absences.length === 0 && <div className="page-sub">Ingen frånvaro anmäld.</div>}
          </div>
        </>
      )}

      {tab === 'tillganglighet' && (
        <>
          {isManager && (
            <div className="chips">
              <button className={`chip ${availView === 'egen' ? 'active' : ''}`} onClick={() => setAvailView('egen')}>Min</button>
              <button className={`chip ${availView === 'alla' ? 'active' : ''}`} onClick={() => setAvailView('alla')}>
                Alla <span className="mono" style={{ marginLeft: 6, opacity: 0.7 }}>{avail.length}</span>
              </button>
            </div>
          )}

          {availView === 'egen' && (
            <>
              <div className="inline-form cols">
                <div>
                  <label className="label">Dag</label>
                  <input className="input" type="date" value={vDay} min={todayIso()} onChange={(e) => setVDay(e.target.value)} />
                </div>
                <div>
                  <label className="label">Jag</label>
                  <select className="select" value={vKind} onChange={(e) => setVKind(e.target.value)}>
                    <option value="tillganglig">kan jobba</option>
                    <option value="onskar">önskar pass</option>
                    <option value="kan_inte">kan inte</option>
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label className="label">Kommentar</label>
                  <input className="input" value={vNote} onChange={(e) => setVNote(e.target.value)} placeholder="t.ex. bara kväll" />
                </div>
                <button className="btn btn-primary" onClick={addAvail} disabled={!vDay}>
                  <CalendarCheck size={15} /> Spara
                </button>
              </div>

              <div className="list">
                {mine.map((v) => (
                  <div key={v.id} className="list-item oncall-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="li-title" style={{ textTransform: 'capitalize' }}>{dayLabel(v.day)}</div>
                      {v.note && <div className="li-meta" style={{ marginTop: 2 }}>{v.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge ${v.kind === 'kan_inte' ? 'b-critical' : v.kind === 'onskar' ? 'b-resolved' : 'b-low'}`}>
                        {AVAIL_LABEL[v.kind] ?? v.kind}
                      </span>
                      <button className="move-btn" onClick={() => removeAvail(v)} aria-label="Ta bort"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {mine.length === 0 && (
                  <div className="page-sub">Du har inte anmält någon tillgänglighet än.</div>
                )}
              </div>
            </>
          )}

          {availView === 'alla' && isManager && (
            <>
              {byDay.map(([d, list]) => {
                const can = list.filter((v) => v.kind === 'tillganglig');
                const want = list.filter((v) => v.kind === 'onskar');
                const cant = list.filter((v) => v.kind === 'kan_inte');
                return (
                  <div key={d} className="card" style={{ marginBottom: 10 }}>
                    <div className="li-title" style={{ textTransform: 'capitalize' }}>{dayLabel(d)}</div>
                    {want.length > 0 && (
                      <div className="stat-row"><span>Önskar pass</span><b>{want.map((v) => name(v.user_id)).join(', ')}</b></div>
                    )}
                    {can.length > 0 && (
                      <div className="stat-row"><span>Kan jobba</span><b>{can.map((v) => name(v.user_id)).join(', ')}</b></div>
                    )}
                    {cant.length > 0 && (
                      <div className="stat-row"><span>Kan inte</span><b style={{ color: 'var(--danger)' }}>{cant.map((v) => name(v.user_id)).join(', ')}</b></div>
                    )}
                  </div>
                );
              })}
              {byDay.length === 0 && <div className="page-sub">Ingen har anmält tillgänglighet framåt.</div>}
            </>
          )}
        </>
      )}

      {tab === 'checklistor' && isManager && <ChecklistAdmin />}

      {tab === 'intro' && <IntroTab userId={userId} role={role} isManager={isManager} onChange={load} />}
    </>
  );
}
