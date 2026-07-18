'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';

type School = { id: string; name: string; address: string | null; capacity: number };
type Team = { id: string; team_name: string; country: string | null; group_size: number; contact_name: string | null; contact_phone: string | null; status: string; classroom_id: string | null };
type Room = { id: string; name: string; capacity: number; notes: string | null };
type Issue = { id: string; title: string; description: string | null; status: string; created_at: string };
type Round = { id: string; all_ok: boolean; notes: string | null; performed_at: string };
type RoomKey = { id: string; label: string; status: string; holder_name: string | null };

type Tab = 'teams' | 'rooms' | 'issues' | 'rounds' | 'keys';

export default function SchoolDetailClient({ school, userId }: { school: School; userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [keys, setKeys] = useState<RoomKey[]>([]);

  // Formulärstate
  const [tName, setTName] = useState(''); const [tCountry, setTCountry] = useState('');
  const [tSize, setTSize] = useState(''); const [tContact, setTContact] = useState(''); const [tPhone, setTPhone] = useState('');
  const [rName, setRName] = useState(''); const [rCap, setRCap] = useState('');
  const [iTitle, setITitle] = useState(''); const [iDesc, setIDesc] = useState('');
  const [nOk, setNOk] = useState(true); const [nNotes, setNNotes] = useState('');
  const [kLabel, setKLabel] = useState('');
  const [editT, setEditT] = useState<Team | null>(null);
  const [eName, setEName] = useState(''); const [eCountry, setECountry] = useState('');
  const [eSize, setESize] = useState(''); const [eContact, setEContact] = useState(''); const [ePhone, setEPhone] = useState('');

  const load = useCallback(async () => {
    const [t, r, i, n, k] = await Promise.all([
      supabase.from('team_assignments').select('id,team_name,country,group_size,contact_name,contact_phone,status,classroom_id').eq('school_id', school.id).order('created_at', { ascending: false }),
      supabase.from('classrooms').select('id,name,capacity,notes').eq('school_id', school.id).order('name'),
      supabase.from('room_issues').select('id,title,description,status,created_at').eq('school_id', school.id).order('created_at', { ascending: false }),
      supabase.from('night_rounds').select('id,all_ok,notes,performed_at').eq('school_id', school.id).order('performed_at', { ascending: false }).limit(20),
      supabase.from('room_keys').select('id,label,status,holder_name').eq('school_id', school.id).order('label')
    ]);
    setTeams((t.data ?? []) as Team[]);
    setRooms((r.data ?? []) as Room[]);
    setIssues((i.data ?? []) as Issue[]);
    setRounds((n.data ?? []) as Round[]);
    setKeys((k.data ?? []) as RoomKey[]);
  }, [supabase, school.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`school-${school.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assignments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_issues' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const inHouse = teams.filter((t) => t.status === 'checked_in').reduce((s, t) => s + t.group_size, 0);
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // ---- Actions ----
  const addTeam = async () => {
    if (!tName) return;
    await supabase.from('team_assignments').insert({
      school_id: school.id, team_name: tName, country: tCountry || null,
      group_size: parseInt(tSize) || 0, contact_name: tContact || null, contact_phone: tPhone || null
    });
    setTName(''); setTCountry(''); setTSize(''); setTContact(''); setTPhone('');
    load();
  };
  const setTeamStatus = async (t: Team, status: string) => {
    await supabase.from('team_assignments').update({
      status,
      checked_in_at: status === 'checked_in' ? new Date().toISOString() : undefined,
      checked_out_at: status === 'checked_out' ? new Date().toISOString() : undefined
    }).eq('id', t.id);
    load();
  };
  const assignRoom = async (t: Team, roomId: string) => {
    await supabase.from('team_assignments').update({ classroom_id: roomId || null }).eq('id', t.id);
    load();
  };
  const addRoom = async () => {
    if (!rName) return;
    await supabase.from('classrooms').insert({ school_id: school.id, name: rName, capacity: parseInt(rCap) || 0 });
    setRName(''); setRCap(''); load();
  };
  const addIssue = async () => {
    if (!iTitle) return;
    await supabase.from('room_issues').insert({ school_id: school.id, title: iTitle, description: iDesc || null, reported_by: userId });
    setITitle(''); setIDesc(''); load();
  };
  const setIssueStatus = async (id: string, status: string) => {
    await supabase.from('room_issues').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', id);
    load();
  };
  const addRound = async () => {
    await supabase.from('night_rounds').insert({ school_id: school.id, all_ok: nOk, notes: nNotes || null, performed_by: userId });
    setNOk(true); setNNotes(''); load();
  };
  const addKey = async () => {
    if (!kLabel) return;
    await supabase.from('room_keys').insert({ school_id: school.id, label: kLabel });
    setKLabel(''); load();
  };
  const cycleKey = async (k: RoomKey) => {
    const holder = k.status === 'in' ? prompt(tr('holder')) : null;
    const next = k.status === 'in' ? 'out' : 'in';
    await supabase.from('room_keys').update({ status: next, holder_name: next === 'out' ? holder : null }).eq('id', k.id);
    load();
  };
  const loseKey = async (k: RoomKey) => {
    await supabase.from('room_keys').update({ status: k.status === 'lost' ? 'in' : 'lost' }).eq('id', k.id);
    load();
  };

  const openEditTeam = (t: Team) => {
    setEditT(t);
    setEName(t.team_name); setECountry(t.country ?? '');
    setESize(String(t.group_size)); setEContact(t.contact_name ?? ''); setEPhone(t.contact_phone ?? '');
  };
  const saveTeam = async () => {
    if (!editT) return;
    await supabase.from('team_assignments').update({
      team_name: eName, country: eCountry || null, group_size: parseInt(eSize) || 0,
      contact_name: eContact || null, contact_phone: ePhone || null
    }).eq('id', editT.id);
    setEditT(null); load();
  };
  const removeTeam = async (t: Team) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('team_assignments').delete().eq('id', t.id); load();
  };
  const removeRoom = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('classrooms').delete().eq('id', id); load();
  };
  const removeIssue = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('room_issues').delete().eq('id', id); load();
  };
  const autoAssign = async () => {
    // Best fit: största laget först in i rummet med minst kvarvarande plats som ändå räcker
    const activeTeams = teams.filter((t) => t.status !== 'checked_out');
    const used = new Map<string, number>();
    for (const r of rooms) used.set(r.id, 0);
    for (const t of activeTeams) if (t.classroom_id && used.has(t.classroom_id)) {
      used.set(t.classroom_id, (used.get(t.classroom_id) ?? 0) + t.group_size);
    }
    const unassigned = activeTeams.filter((t) => !t.classroom_id).sort((a, b) => b.group_size - a.group_size);
    let placed = 0;
    for (const t of unassigned) {
      const fit = rooms
        .map((r) => ({ r, left: r.capacity - (used.get(r.id) ?? 0) }))
        .filter((x) => x.left >= t.group_size)
        .sort((a, b) => a.left - b.left)[0];
      if (!fit) continue;
      await supabase.from('team_assignments').update({ classroom_id: fit.r.id }).eq('id', t.id);
      used.set(fit.r.id, (used.get(fit.r.id) ?? 0) + t.group_size);
      placed++;
    }
    alert(`${placed} ${tr('autoAssigned')}`);
    load();
  };

  const removeKey = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('room_keys').delete().eq('id', id); load();
  };

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? null;
  const tmLabel = (s: string) => s === 'expected' ? tr('tmExpected') : s === 'checked_in' ? tr('tmCheckedIn') : tr('tmCheckedOut');

  return (
    <>
      <Link href="/schools" className="btn btn-sm btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={14} /> {tr('back')}
      </Link>
      <h1 className="page-title">{school.name}</h1>
      <div className="page-sub">{school.address ?? ''} · <span className="mono">{inHouse}/{school.capacity}</span> {tr('capacity').toLowerCase()}</div>

      <div className="tabs">
        <button className={`tab ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>{tr('teams')} <span className="mono">{teams.length}</span></button>
        <button className={`tab ${tab === 'rooms' ? 'active' : ''}`} onClick={() => setTab('rooms')}>{tr('classrooms')} <span className="mono">{rooms.length}</span></button>
        <button className={`tab ${tab === 'issues' ? 'active' : ''}`} onClick={() => setTab('issues')}>{tr('issues')} <span className="mono">{issues.filter((i) => i.status !== 'resolved').length}</span></button>
        <button className={`tab ${tab === 'rounds' ? 'active' : ''}`} onClick={() => setTab('rounds')}>{tr('nightRounds')}</button>
        <button className={`tab ${tab === 'keys' ? 'active' : ''}`} onClick={() => setTab('keys')}>{tr('roomKeys')}</button>
      </div>

      {tab === 'teams' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">{tr('teams')}</label><input className="input" value={tName} onChange={(e) => setTName(e.target.value)} /></div>
            <div><label className="label">{tr('country')}</label><input className="input" value={tCountry} onChange={(e) => setTCountry(e.target.value)} /></div>
            <div><label className="label">{tr('groupSize')}</label><input className="input" type="number" value={tSize} onChange={(e) => setTSize(e.target.value)} /></div>
            <div><label className="label">{tr('contactName')}</label><input className="input" value={tContact} onChange={(e) => setTContact(e.target.value)} /></div>
            <div><label className="label">{tr('phone')}</label><input className="input" value={tPhone} onChange={(e) => setTPhone(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addTeam}>{tr('addTeam')}</button>
          <button className="btn" onClick={autoAssign}>{tr('autoAssign')}</button>
          </div>
          <div className="list">
            {teams.map((t) => (
              <div key={t.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{t.team_name} {t.country ? `· ${t.country}` : ''}</div>
                    <div className="li-meta">{t.group_size} pers{t.contact_name ? ` · ${t.contact_name}` : ''}{t.contact_phone ? ` · ${t.contact_phone}` : ''}{roomName(t.classroom_id) ? ` · ${roomName(t.classroom_id)}` : ''}</div>
                  </div>
                  <span className={`badge b-${t.status}`}>{tmLabel(t.status)}</span>
                </div>
                <div className="li-actions">
                  {t.status !== 'checked_in' && <button className="btn btn-sm btn-primary" onClick={() => setTeamStatus(t, 'checked_in')}>{tr('checkIn')}</button>}
                  {t.status === 'checked_in' && <button className="btn btn-sm" onClick={() => setTeamStatus(t, 'checked_out')}>{tr('checkOut')}</button>}
                  <select className="select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                    value={t.classroom_id ?? ''} onChange={(e) => assignRoom(t, e.target.value)}>
                    <option value="">{tr('classrooms')}: {tr('none').toLowerCase()}</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="btn btn-sm" onClick={() => openEditTeam(t)}>{tr('edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeTeam(t)}>{tr('deleteLbl')}</button>
                </div>
                {editT?.id === t.id && (
                  <div className="inline-form cols" style={{ marginTop: 10, marginBottom: 0 }}>
                    <div><label className="label">{tr('teams')}</label><input className="input" value={eName} onChange={(e) => setEName(e.target.value)} /></div>
                    <div><label className="label">{tr('country')}</label><input className="input" value={eCountry} onChange={(e) => setECountry(e.target.value)} /></div>
                    <div><label className="label">{tr('groupSize')}</label><input className="input" type="number" value={eSize} onChange={(e) => setESize(e.target.value)} /></div>
                    <div><label className="label">{tr('contactName')}</label><input className="input" value={eContact} onChange={(e) => setEContact(e.target.value)} /></div>
                    <div><label className="label">{tr('phone')}</label><input className="input" value={ePhone} onChange={(e) => setEPhone(e.target.value)} /></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => setEditT(null)}>{tr('cancel')}</button>
                      <button className="btn btn-sm btn-primary" onClick={saveTeam}>{tr('save')}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {teams.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}

      {tab === 'rooms' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">{tr('name')}</label><input className="input" value={rName} onChange={(e) => setRName(e.target.value)} /></div>
            <div><label className="label">{tr('capacity')}</label><input className="input" type="number" value={rCap} onChange={(e) => setRCap(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addRoom}>{tr('addClassroom')}</button>
          </div>
          <div className="list">
            {rooms.map((r) => {
              const occupants = teams.filter((t) => t.classroom_id === r.id && t.status === 'checked_in');
              return (
                <div key={r.id} className="list-item">
                  <div className="li-head">
                    <div>
                      <div className="li-title">{r.name}</div>
                      <div className="li-meta">{occupants.map((o) => o.team_name).join(', ') || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: 13, color: occupants.reduce((s, o) => s + o.group_size, 0) > r.capacity ? 'var(--danger)' : undefined, fontWeight: occupants.reduce((s, o) => s + o.group_size, 0) > r.capacity ? 700 : undefined }}>{occupants.reduce((s, o) => s + o.group_size, 0)}/{r.capacity}</span>
                      <button className="btn btn-sm btn-danger" onClick={() => removeRoom(r.id)}>{tr('deleteLbl')}</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {rooms.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}

      {tab === 'issues' && (
        <>
          <div className="inline-form">
            <div><label className="label">{tr('title')}</label><input className="input" value={iTitle} onChange={(e) => setITitle(e.target.value)} /></div>
            <div><label className="label">{tr('description')}</label><textarea className="textarea" value={iDesc} onChange={(e) => setIDesc(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addIssue}>{tr('newIssue')}</button>
          </div>
          <div className="list">
            {issues.map((i) => (
              <div key={i.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{i.title}</div>
                    {i.description && <div className="li-meta">{i.description}</div>}
                    <div className="li-meta mono">{fmt(i.created_at)}</div>
                  </div>
                  <span className={`badge b-${i.status}`}>{i.status === 'open' ? tr('stOpen') : i.status === 'in_progress' ? tr('stInProgress') : tr('stResolved')}</span>
                </div>
                <div className="li-actions">
                  {i.status === 'open' && <button className="btn btn-sm" onClick={() => setIssueStatus(i.id, 'in_progress')}>{tr('markInProgress')}</button>}
                  {i.status !== 'resolved' && <button className="btn btn-sm" onClick={() => setIssueStatus(i.id, 'resolved')}>{tr('markResolved')}</button>}
                  {i.status === 'resolved' && <button className="btn btn-sm" onClick={() => setIssueStatus(i.id, 'open')}>{tr('reopen')}</button>}
                  <button className="btn btn-sm btn-danger" onClick={() => removeIssue(i.id)}>{tr('deleteLbl')}</button>
                </div>
              </div>
            ))}
            {issues.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}

      {tab === 'rounds' && (
        <>
          <div className="inline-form">
            <label className="check-row" style={{ border: 'none', padding: 0, background: 'none' }}>
              <input type="checkbox" checked={nOk} onChange={(e) => setNOk(e.target.checked)} /> {tr('allOk')}
            </label>
            <div><label className="label">{tr('notes')}</label><textarea className="textarea" value={nNotes} onChange={(e) => setNNotes(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addRound}>{tr('newRound')}</button>
          </div>
          <div className="list">
            {rounds.map((r) => (
              <div key={r.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title mono">{fmt(r.performed_at)}</div>
                    {r.notes && <div className="li-meta">{r.notes}</div>}
                  </div>
                  <span className={`badge ${r.all_ok ? 'b-resolved' : 'b-critical'}`}>{r.all_ok ? tr('allOk') : '!'}</span>
                </div>
              </div>
            ))}
            {rounds.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}

      {tab === 'keys' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">{tr('name')}</label><input className="input" value={kLabel} onChange={(e) => setKLabel(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addKey}>{tr('addKey')}</button>
          </div>
          <div className="list">
            {keys.map((k) => (
              <div key={k.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{k.label}</div>
                    {k.holder_name && <div className="li-meta">{tr('holder')}: {k.holder_name}</div>}
                  </div>
                  <span className={`badge b-${k.status}`}>{k.status === 'in' ? tr('keyIn') : k.status === 'out' ? tr('keyOut') : tr('keyLost')}</span>
                </div>
                <div className="li-actions">
                  {k.status !== 'lost' && <button className="btn btn-sm" onClick={() => cycleKey(k)}>{k.status === 'in' ? tr('checkOut') : tr('checkIn')}</button>}
                  <button className="btn btn-sm btn-ghost" onClick={() => loseKey(k)}>{k.status === 'lost' ? tr('reopen') : tr('keyLost')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeKey(k.id)}>{tr('deleteLbl')}</button>
                </div>
              </div>
            ))}
            {keys.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}
    </>
  );
}
