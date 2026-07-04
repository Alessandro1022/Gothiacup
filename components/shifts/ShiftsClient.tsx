'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';
import { tierOf, type Role } from '@/lib/types';

type Shift = {
  id: string; user_id: string | null;
  location_type: 'school' | 'arena' | null; location_id: string | null;
  starts_at: string; ends_at: string; role_note: string | null;
  status: 'planned' | 'checked_in' | 'checked_out' | 'missed';
};
type Loc = { id: string; name: string };
type Person = { id: string; full_name: string };

export default function ShiftsClient({ userId, role }: { userId: string; role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schools, setSchools] = useState<Loc[]>([]);
  const [arenas, setArenas] = useState<Loc[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [view, setView] = useState<'mine' | 'all'>(tier >= 3 ? 'all' : 'mine');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [fPerson, setFPerson] = useState(''); const [fLoc, setFLoc] = useState('');
  const [fStart, setFStart] = useState(''); const [fEnd, setFEnd] = useState(''); const [fNote, setFNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('shifts')
      .select('id,user_id,location_type,location_id,starts_at,ends_at,role_note,status')
      .order('starts_at');
    setShifts((data ?? []) as Shift[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('schools').select('id,name').then(({ data }) => setSchools(data ?? []));
    supabase.from('arenas').select('id,name').then(({ data }) => setArenas(data ?? []));
    supabase.from('profiles').select('id,full_name').then(({ data }) => setPeople(data ?? []));
    const ch = supabase.channel('shifts-page-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const createShift = async () => {
    if (!fStart || !fEnd) return;
    setSaving(true);
    const [lt, lid] = fLoc ? fLoc.split(':') : [null, null];
    await supabase.from('shifts').insert({
      user_id: fPerson || null, location_type: lt, location_id: lid,
      starts_at: new Date(fStart).toISOString(), ends_at: new Date(fEnd).toISOString(),
      role_note: fNote || null, created_by: userId
    });
    setSaving(false); setShowModal(false);
    setFPerson(''); setFLoc(''); setFStart(''); setFEnd(''); setFNote('');
    load();
  };

  const check = async (s: Shift, dir: 'in' | 'out') => {
    await supabase.from('shifts').update(
      dir === 'in'
        ? { status: 'checked_in', checked_in_at: new Date().toISOString() }
        : { status: 'checked_out', checked_out_at: new Date().toISOString() }
    ).eq('id', s.id);
    load();
  };

  const locName = (s: Shift) => {
    if (!s.location_id) return null;
    const list = s.location_type === 'school' ? schools : arenas;
    return list.find((l) => l.id === s.location_id)?.name ?? null;
  };
  const personName = (id: string | null) => people.find((p) => p.id === id)?.full_name || tr('unassigned');
  const stLabel = (s: string) => s === 'planned' ? tr('shPlanned') : s === 'checked_in' ? tr('tmCheckedIn') : s === 'checked_out' ? tr('tmCheckedOut') : tr('shMissed');
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const visible = shifts.filter((s) => view === 'mine' ? s.user_id === userId : true);

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">{tr('shifts')}</h1>
        {tier >= 3 && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} style={{ verticalAlign: -2, marginRight: 5 }} />{tr('newShift')}
          </button>
        )}
      </div>

      <div className="chips">
        <button className={`chip ${view === 'mine' ? 'active' : ''}`} onClick={() => setView('mine')}>{tr('myShifts')}</button>
        {tier >= 3 && <button className={`chip ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>{tr('allShifts')}</button>}
      </div>

      {loading && <div className="page-sub">{tr('loading')}</div>}
      <div className="list">
        {!loading && visible.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
        {visible.map((s) => (
          <div key={s.id} className="list-item">
            <div className="li-head">
              <div>
                <div className="li-title mono">{fmt(s.starts_at)} → {fmt(s.ends_at)}</div>
                <div className="li-meta">{personName(s.user_id)}{locName(s) ? ` · ${locName(s)}` : ''}{s.role_note ? ` · ${s.role_note}` : ''}</div>
              </div>
              <span className={`badge b-${s.status}`}>{stLabel(s.status)}</span>
            </div>
            {s.user_id === userId && (
              <div className="li-actions">
                {s.status === 'planned' && <button className="btn btn-sm btn-primary" onClick={() => check(s, 'in')}>{tr('checkIn')}</button>}
                {s.status === 'checked_in' && <button className="btn btn-sm" onClick={() => check(s, 'out')}>{tr('checkOut')}</button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{tr('newShift')}</h3>

            <label className="label">{tr('person')}</label>
            <select className="select" value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
              <option value="">{tr('unassigned')}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 6)}</option>)}
            </select>

            <label className="label">{tr('location')}</label>
            <select className="select" value={fLoc} onChange={(e) => setFLoc(e.target.value)}>
              <option value="">{tr('none')}</option>
              <optgroup label={tenant.labels.schools}>
                {schools.map((s) => <option key={s.id} value={`school:${s.id}`}>{s.name}</option>)}
              </optgroup>
              <optgroup label={tenant.labels.playingAreas}>
                {arenas.map((a) => <option key={a.id} value={`arena:${a.id}`}>{a.name}</option>)}
              </optgroup>
            </select>

            <label className="label">{tr('startTime')}</label>
            <input className="input" type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} />

            <label className="label">{tr('endTime')}</label>
            <input className="input" type="datetime-local" value={fEnd} onChange={(e) => setFEnd(e.target.value)} />

            <label className="label">{tr('notes')}</label>
            <input className="input" value={fNote} onChange={(e) => setFNote(e.target.value)} />

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>{tr('cancel')}</button>
              <button className="btn btn-primary" disabled={!fStart || !fEnd || saving} onClick={createShift}>{tr('create')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
