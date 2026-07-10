'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';
import { tenant } from '@/lib/tenant';

type Shift = {
  id: string; user_id: string | null; location_type: string | null; location_id: string | null;
  starts_at: string; ends_at: string; role_note: string | null; status: string;
  checkin_code: string;
};
type Swap = { id: string; shift_id: string; requested_by: string; note: string | null; status: string; created_at: string };
type Opt = { id: string; name: string };
type Person = { id: string; full_name: string };

export default function ShiftsClient({ userId, role }: { userId: string; role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [view, setView] = useState<'mine' | 'all'>('mine');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [schools, setSchools] = useState<Opt[]>([]);
  const [arenas, setArenas] = useState<Opt[]>([]);
  const [modal, setModal] = useState(false);
  const [qrShift, setQrShift] = useState<Shift | null>(null);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState<'' | 'ok' | 'err'>('');
  const [loading, setLoading] = useState(true);
  // Nytt pass
  const [fUser, setFUser] = useState(''); const [fLoc, setFLoc] = useState('');
  const [fStart, setFStart] = useState(''); const [fEnd, setFEnd] = useState(''); const [fNote, setFNote] = useState('');

  const load = useCallback(async () => {
    let q = supabase.from('shifts')
      .select('id,user_id,location_type,location_id,starts_at,ends_at,role_note,status,checkin_code')
      .order('starts_at');
    if (view === 'mine') q = q.eq('user_id', userId);
    const [{ data: sh }, { data: sw }] = await Promise.all([
      q,
      supabase.from('shift_swaps').select('id,shift_id,requested_by,note,status,created_at').order('created_at', { ascending: false }).limit(30)
    ]);
    setShifts((sh ?? []) as Shift[]);
    setSwaps((sw ?? []) as Swap[]);
    setLoading(false);
  }, [supabase, view, userId]);

  useEffect(() => {
    load();
    supabase.from('profiles').select('id,full_name').then(({ data }) => setPeople((data ?? []) as Person[]));
    supabase.from('schools').select('id,name').then(({ data }) => setSchools((data ?? []) as Opt[]));
    supabase.from('arenas').select('id,name').then(({ data }) => setArenas((data ?? []) as Opt[]));
    const ch = supabase.channel('shifts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swaps' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const name = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? '—';
  const locName = (s: Shift) => {
    if (!s.location_type || !s.location_id) return tr('none');
    const list = s.location_type === 'school' ? schools : arenas;
    return list.find((x) => x.id === s.location_id)?.name ?? '—';
  };
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const shLabel = (s: string) => s === 'planned' ? tr('shPlanned') : s === 'checked_in' ? tr('tmCheckedIn') : s === 'checked_out' ? tr('tmCheckedOut') : tr('shMissed');
  const swLabel = (s: string) => s === 'pending' ? tr('swPending') : s === 'approved' ? tr('swApproved') : tr('swRejected');

  // ---- Actions ----
  const selfCheck = async (s: Shift, status: 'checked_in' | 'checked_out') => {
    await supabase.from('shifts').update({
      status,
      checked_in_at: status === 'checked_in' ? new Date().toISOString() : undefined,
      checked_out_at: status === 'checked_out' ? new Date().toISOString() : undefined
    }).eq('id', s.id);
    load();
  };
  const codeCheckin = async () => {
    const c = code.trim().toLowerCase();
    if (!c) return;
    const { data } = await supabase.from('shifts').select('id').eq('checkin_code', c).eq('user_id', userId).limit(1);
    if (!data?.length) { setCodeMsg('err'); return; }
    await supabase.from('shifts').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', data[0].id);
    setCode(''); setCodeMsg('ok'); load();
  };
  const createShift = async () => {
    if (!fStart || !fEnd) return;
    const [lt, li] = fLoc ? fLoc.split(':') : [null, null];
    await supabase.from('shifts').insert({
      user_id: fUser || null, location_type: lt, location_id: li,
      starts_at: new Date(fStart).toISOString(), ends_at: new Date(fEnd).toISOString(),
      role_note: fNote || null, created_by: userId
    });
    setModal(false); setFUser(''); setFLoc(''); setFStart(''); setFEnd(''); setFNote('');
    load();
  };
  const markMissed = async (s: Shift) => { await supabase.from('shifts').update({ status: 'missed' }).eq('id', s.id); load(); };
  const removeShift = async (s: Shift) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('shifts').delete().eq('id', s.id); load();
  };
  const requestSwap = async (s: Shift) => {
    const note = prompt(tr('notes')) ?? '';
    await supabase.from('shift_swaps').insert({ shift_id: s.id, requested_by: userId, note: note || null });
    load();
  };
  const decideSwap = async (sw: Swap, status: 'approved' | 'rejected') => {
    await supabase.from('shift_swaps').update({ status, decided_by: userId, decided_at: new Date().toISOString() }).eq('id', sw.id);
    // Godkänt byte: passet öppnas upp (otilldelat) så chefer kan sätta ny person
    if (status === 'approved') {
      await supabase.from('shifts').update({ user_id: null, status: 'planned' }).eq('id', sw.shift_id);
    }
    load();
  };

  const pendingSwaps = swaps.filter((s) => s.status === 'pending');
  const shiftById = (id: string) => shifts.find((s) => s.id === id);

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title">{tr('shifts')}</h1>
          <div className="page-sub" style={{ marginBottom: 0 }}>{tenant.event.name}</div>
        </div>
        {tier >= 3 && (
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} style={{ verticalAlign: -2, marginRight: 5 }} />{tr('newShift')}
          </button>
        )}
      </div>

      {/* Kodincheckning */}
      <div className="inline-form cols" style={{ marginTop: 14 }}>
        <div><label className="label">{tr('codeCheckin')}</label>
          <input className="input" value={code} onChange={(e) => { setCode(e.target.value); setCodeMsg(''); }} placeholder={tr('codeLbl')} />
        </div>
        <button className="btn btn-primary" onClick={codeCheckin}>{tr('checkIn')}</button>
      </div>
      {codeMsg === 'ok' && <div className="ok-msg" style={{ marginTop: -8, marginBottom: 12 }}>{tr('checkedInOk')}</div>}
      {codeMsg === 'err' && <div className="form-error" style={{ marginTop: -8, marginBottom: 12 }}>{tr('wrongCode')}</div>}

      <div className="chips">
        <button className={`chip ${view === 'mine' ? 'active' : ''}`} onClick={() => setView('mine')}>{tr('myShifts')}</button>
        {tier >= 3 && <button className={`chip ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>{tr('allShifts')}</button>}
      </div>

      {/* Bytesförfrågningar (chefer) */}
      {tier >= 3 && pendingSwaps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>{tr('swapReqs')} <span className="badge b-pending">{pendingSwaps.length}</span></h2>
          <div className="list">
            {pendingSwaps.map((sw) => {
              const s = shiftById(sw.shift_id);
              return (
                <div key={sw.id} className="list-item">
                  <div className="li-head">
                    <div>
                      <div className="li-title">{name(sw.requested_by)}</div>
                      <div className="li-meta">{s ? `${locName(s)} · ${fmt(s.starts_at)}–${fmt(s.ends_at)}` : '—'}{sw.note ? ` · ${sw.note}` : ''}</div>
                    </div>
                    <span className={`badge b-${sw.status}`}>{swLabel(sw.status)}</span>
                  </div>
                  <div className="li-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => decideSwap(sw, 'approved')}>{tr('approve')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => decideSwap(sw, 'rejected')}>{tr('reject')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && <div className="page-sub">{tr('loading')}</div>}
      <div className="list">
        {shifts.map((s) => {
          const mine = s.user_id === userId;
          const mySwap = swaps.find((x) => x.shift_id === s.id && x.requested_by === userId && x.status === 'pending');
          return (
            <div key={s.id} className="list-item">
              <div className="li-head">
                <div>
                  <div className="li-title">{view === 'all' ? name(s.user_id) : locName(s)}</div>
                  <div className="li-meta">{view === 'all' ? `${locName(s)} · ` : ''}<span className="mono">{fmt(s.starts_at)} – {fmt(s.ends_at)}</span>{s.role_note ? ` · ${s.role_note}` : ''}</div>
                </div>
                <span className={`badge b-${s.status}`}>{shLabel(s.status)}</span>
              </div>
              <div className="li-actions">
                {mine && s.status === 'planned' && <button className="btn btn-sm btn-primary" onClick={() => selfCheck(s, 'checked_in')}>{tr('checkIn')}</button>}
                {mine && s.status === 'checked_in' && <button className="btn btn-sm" onClick={() => selfCheck(s, 'checked_out')}>{tr('checkOut')}</button>}
                {mine && s.status === 'planned' && !mySwap && <button className="btn btn-sm" onClick={() => requestSwap(s)}>{tr('requestSwap')}</button>}
                {mySwap && <span className="badge b-pending">{tr('requestSwap')}: {swLabel(mySwap.status)}</span>}
                {tier >= 3 && (
                  <>
                    <button className="btn btn-sm" onClick={() => setQrShift(s)}>
                      <QrCode size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{tr('showQr')}
                    </button>
                    {s.status === 'planned' && <button className="btn btn-sm" onClick={() => markMissed(s)}>{tr('shMissed')}</button>}
                    <button className="btn btn-sm btn-danger" onClick={() => removeShift(s)}>{tr('deleteLbl')}</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!loading && shifts.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>

      {/* QR-modal */}
      {qrShift && (
        <div className="modal-overlay" onClick={() => setQrShift(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h3>{tr('checkinCode')}</h3>
            <div className="page-sub">{name(qrShift.user_id)} · {locName(qrShift)}</div>
            <div style={{ background: '#fff', display: 'inline-block', padding: 14, borderRadius: 14, border: '1px solid var(--line)' }}>
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkin/${qrShift.checkin_code}`} size={190} />
            </div>
            <div className="mono" style={{ fontSize: 20, letterSpacing: '.15em', margin: '14px 0 4px' }}>{qrShift.checkin_code}</div>
            <div className="page-sub" style={{ marginBottom: 0 }}>Skanna eller ange koden under &quot;{tr('codeCheckin')}&quot;.</div>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setQrShift(null)}>{tr('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Nytt pass-modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{tr('newShift')}</h3>
            <label className="label">{tr('person')}</label>
            <select className="select" value={fUser} onChange={(e) => setFUser(e.target.value)}>
              <option value="">{tr('unassigned')}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
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
              <button className="btn" onClick={() => setModal(false)}>{tr('cancel')}</button>
              <button className="btn btn-primary" onClick={createShift}>{tr('create')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
