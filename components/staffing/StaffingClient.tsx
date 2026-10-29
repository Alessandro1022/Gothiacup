'use client';
// Bemanning: brister, frånvaro, tillgänglighet och introduktion.
//
// Frånvaro visas bara för personen själv och för ledningen. Att en kollega
// kan se vem som är sjukskriven är inte en driftfråga, och tabellen har
// därför heller ingen plats för orsak — bara att någon inte kommer.
import { useCallback, useEffect, useState } from 'react';
import {
  TriangleAlert, CalendarOff, CalendarCheck, GraduationCap, Plus, Check
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { tierOf, type Role, ROLE_LABELS } from '@/lib/types';

type Gap = {
  shift_id: string; starts_at: string; ends_at: string; role_note: string | null;
  location_name: string; assigned_name: string | null; gap_kind: string;
};
type Absence = {
  id: string; user_id: string; kind: string; from_date: string; to_date: string;
  replacement_user_id: string | null;
};
type Person = { id: string; full_name: string; role: Role };
type Avail = { id: string; day: string; kind: string; note: string };
type Onboard = {
  id: string; title: string; body: string; required: boolean; sort_order: number;
};

const GAP_LABEL: Record<string, string> = {
  obemannat: 'Obemannat',
  'franvarande utan ersattare': 'Frånvarande utan ersättare',
  'ej incheckad': 'Ej incheckad'
};
const ABSENCE_LABEL: Record<string, string> = {
  sjuk: 'Sjuk', vab: 'Vård av barn', ledig: 'Ledig', annat: 'Annat'
};

export default function StaffingClient({ userId, role }: { userId: string; role: Role }) {
  const supabase = createClient();
  const tier = tierOf(role);
  const isManager = tier >= 4;

  const [tab, setTab] = useState<'brister' | 'franvaro' | 'tillganglighet' | 'intro'>(
    isManager ? 'brister' : 'tillganglighet'
  );
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [avail, setAvail] = useState<Avail[]>([]);
  const [items, setItems] = useState<Onboard[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

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
      supabase.from('availability').select('id,day,kind,note').eq('user_id', userId).order('day'),
      supabase.from('onboarding_items').select('*').order('sort_order'),
      supabase.from('onboarding_done').select('item_id').eq('user_id', userId)
    ]);
    setGaps((g.data ?? []) as Gap[]);
    setAbsences((a.data ?? []) as Absence[]);
    setPeople((p.data ?? []) as Person[]);
    setAvail((v.data ?? []) as Avail[]);
    setItems((i.data ?? []) as Onboard[]);
    setDone(new Set(((d.data ?? []) as { item_id: string }[]).map((x) => x.item_id)));
    setLoading(false);
  }, [supabase, userId, isManager]);

  useEffect(() => { load(); }, [load]);

  const addAbsence = async () => {
    const who = isManager ? (aUser || userId) : userId;
    if (!aFrom || !aTo) { setErr('Välj datum.'); return; }
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
    if (error) { setErr(error.message); return; }
    setVDay(''); setVNote(''); load();
  };

  const markDone = async (it: Onboard) => {
    await supabase.from('onboarding_done').insert({ item_id: it.id, user_id: userId });
    load();
  };

  const name = (id: string | null) =>
    id ? (people.find((p) => p.id === id)?.full_name || '—') : '—';
  const fmt = (d: string) =>
    new Date(d).toLocaleString('sv-SE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const requiredLeft = items.filter((i) => i.required && !done.has(i.id)).length;

  if (loading) return <div className="page-sub">Laddar…</div>;

  return (
    <>
      <h1 className="page-title">Bemanning</h1>
      <div className="page-sub">
        {isManager ? `${gaps.length} brister · ` : ''}
        {requiredLeft > 0 ? `${requiredLeft} punkter kvar i introduktionen` : 'introduktionen klar'}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="tabs">
        {isManager && (
          <button className={`tab ${tab === 'brister' ? 'active' : ''}`} onClick={() => setTab('brister')}>
            Brister <span className="mono">{gaps.length}</span>
          </button>
        )}
        <button className={`tab ${tab === 'franvaro' ? 'active' : ''}`} onClick={() => setTab('franvaro')}>
          Frånvaro
        </button>
        <button className={`tab ${tab === 'tillganglighet' ? 'active' : ''}`} onClick={() => setTab('tillganglighet')}>
          Tillgänglighet
        </button>
        <button className={`tab ${tab === 'intro' ? 'active' : ''}`} onClick={() => setTab('intro')}>
          Introduktion {requiredLeft > 0 && <span className="mono">{requiredLeft}</span>}
        </button>
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
                  {!a.replacement_user_id && <span className="badge b-critical">ersättare saknas</span>}
                </div>
                {isManager && (
                  <div className="li-actions">
                    <select className="select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                      value={a.replacement_user_id ?? ''}
                      onChange={(e) => setReplacement(a, e.target.value)}>
                      <option value="">Ersättare: ingen</option>
                      {people.map((p) => (
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
          <div className="inline-form cols">
            <div>
              <label className="label">Dag</label>
              <input className="input" type="date" value={vDay} onChange={(e) => setVDay(e.target.value)} />
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
              <input className="input" value={vNote} onChange={(e) => setVNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={addAvail} disabled={!vDay}>
              <CalendarCheck size={15} /> Spara
            </button>
          </div>

          <div className="list">
            {avail.map((v) => (
              <div key={v.id} className="list-item" style={{ padding: '9px 0' }}>
                <div className="li-head">
                  <div>
                    <div style={{ fontSize: 14 }}>{v.day}</div>
                    {v.note && <div className="li-meta">{v.note}</div>}
                  </div>
                  <span className={`badge ${v.kind === 'kan_inte' ? 'b-critical' : 'b-low'}`}>
                    {v.kind === 'tillganglig' ? 'kan jobba' : v.kind === 'onskar' ? 'önskar pass' : 'kan inte'}
                  </span>
                </div>
              </div>
            ))}
            {avail.length === 0 && (
              <div className="page-sub">Du har inte anmält någon tillgänglighet än.</div>
            )}
          </div>
        </>
      )}

      {tab === 'intro' && (
        <div className="list">
          {items.map((it) => (
            <div key={it.id} className="list-item">
              <div className="li-head">
                <div>
                  <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <GraduationCap size={15} /> {it.title}
                    {!it.required && <span className="li-meta" style={{ marginTop: 0 }}>frivillig</span>}
                  </div>
                  {it.body && (
                    <div className="li-meta" style={{ whiteSpace: 'pre-wrap' }}>{it.body}</div>
                  )}
                </div>
                {done.has(it.id) && <span className="badge b-resolved">klar</span>}
              </div>
              {!done.has(it.id) && (
                <div className="li-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => markDone(it)}>
                    <Check size={13} /> Läst och förstått
                  </button>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="page-sub">
              Ingen introduktion upplagd än.
              {isManager && ' Lägg upp punkter så får ny personal dem vid första inloggningen.'}
            </div>
          )}
        </div>
      )}
    </>
  );
}
