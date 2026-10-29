'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { useTenant } from '@/components/TenantProvider';
import EmergencyCard from '@/components/EmergencyCard';
import ChecklistRuns from '@/components/checklists/ChecklistRuns';

type Arena = { id: string; name: string; address: string | null; surface_count: number };
type Match = { id: string; surface_label: string; home_team: string; away_team: string; category: string | null; starts_at: string; status: string; risk_level: string; risk_note: string | null; home_score: number | null; away_score: number | null; group_name: string; walkover_team: string; report: string; referee_id: string | null; original_starts_at: string | null; change_reason: string; protest: string; protest_status: string };
type Referee = { id: string; full_name: string; phone: string; active: boolean };
type SecLog = { id: string; entry: string; severity: string; created_at: string };
type Crowd = { id: string; count: number; created_at: string };

type Tab = 'matches' | 'security' | 'crowd' | 'checklists';
const MATCH_STATUSES = ['scheduled', 'ongoing', 'finished', 'cancelled'] as const;

export default function ArenaDetailClient({ arena, userId }: { arena: Arena; userId: string }) {
  const { tr } = useLang();
  const tn = useTenant();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [logs, setLogs] = useState<SecLog[]>([]);
  const [crowd, setCrowd] = useState<Crowd[]>([]);

  // Formulär
  const [mSurf, setMSurf] = useState(''); const [mHome, setMHome] = useState(''); const [mAway, setMAway] = useState('');
  const [mCat, setMCat] = useState(''); const [mTime, setMTime] = useState('');
  const [mGroup, setMGroup] = useState('');
  const [sEntry, setSEntry] = useState(''); const [sSev, setSSev] = useState('low');
  const [cCount, setCCount] = useState('');
  const [editM, setEditM] = useState<Match | null>(null);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [scoreFor, setScoreFor] = useState<string | null>(null);
  const [sHome, setSHome] = useState(''); const [sAway, setSAway] = useState('');
  const [sReport, setSReport] = useState(''); const [sWo, setSWo] = useState('');
  const [sProtest, setSProtest] = useState(''); const [sProtestStatus, setSProtestStatus] = useState('');
  const [emSurf, setEmSurf] = useState(''); const [emHome, setEmHome] = useState(''); const [emAway, setEmAway] = useState('');
  const [emCat, setEmCat] = useState(''); const [emTime, setEmTime] = useState('');
  const [emGroup, setEmGroup] = useState(''); const [emReason, setEmReason] = useState('');
  const [emRisk, setEmRisk] = useState('green'); const [emRiskNote, setEmRiskNote] = useState('');

  const load = useCallback(async () => {
    const [m, s, c, ref] = await Promise.all([
      supabase.from('arena_matches').select('id,surface_label,home_team,away_team,category,starts_at,status,risk_level,risk_note,home_score,away_score,group_name,walkover_team,report,referee_id,original_starts_at,change_reason,protest,protest_status').eq('arena_id', arena.id).order('starts_at'),
      supabase.from('security_logs').select('id,entry,severity,created_at').eq('arena_id', arena.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('crowd_counts').select('id,count,created_at').eq('arena_id', arena.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('referees').select('id,full_name,phone,active').eq('active', true).order('full_name')
    ]);
    setMatches((m.data ?? []) as Match[]);
    setReferees((ref.data ?? []) as Referee[]);
    setLogs((s.data ?? []) as SecLog[]);
    setCrowd((c.data ?? []) as Crowd[]);
  }, [supabase, arena.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`arena-${arena.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_logs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crowd_counts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const msLabel = (s: string) => s === 'scheduled' ? tr('msScheduled') : s === 'ongoing' ? tr('msOngoing') : s === 'finished' ? tr('msFinished') : tr('msCancelled');
  const sevLabel = (s: string) => s === 'low' ? tr('sevLow') : s === 'medium' ? tr('sevMedium') : s === 'high' ? tr('sevHigh') : tr('sevCritical');

  // ---- Actions ----
  const addMatch = async () => {
    if (!mHome || !mAway || !mTime) return;
    await supabase.from('arena_matches').insert({
      arena_id: arena.id, surface_label: mSurf || `${tn.labels.playingArea} 1`,
      home_team: mHome, away_team: mAway, category: mCat || null, group_name: mGroup.trim(),
      starts_at: new Date(mTime).toISOString()
    });
    setMSurf(''); setMHome(''); setMAway(''); setMCat(''); setMTime(''); setMGroup('');
    load();
  };
  const openEditMatch = (m: Match) => {
    setEditM(m);
    setEmSurf(m.surface_label); setEmHome(m.home_team); setEmAway(m.away_team);
    setEmCat(m.category ?? ''); setEmGroup(m.group_name ?? ''); setEmReason('');
    setEmRisk(m.risk_level); setEmRiskNote(m.risk_note ?? '');
    const d = new Date(m.starts_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEmTime(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };
  const saveMatch = async () => {
    if (!editM) return;
    await supabase.from('arena_matches').update({
      surface_label: emSurf, home_team: emHome, away_team: emAway,
      category: emCat || null, starts_at: new Date(emTime).toISOString(),
      risk_level: emRisk, risk_note: emRiskNote || null, group_name: emGroup.trim(),
      // Orsaken följer med i notisen till personalen när tiden ändras
      ...(emReason.trim() ? { change_reason: emReason.trim() } : {})
    }).eq('id', editM.id);
    setEditM(null); load();
  };
  const openScore = (m: Match) => {
    setScoreFor(m.id);
    setSHome(m.home_score === null ? '' : String(m.home_score));
    setSAway(m.away_score === null ? '' : String(m.away_score));
    setSReport(m.report ?? ''); setSWo(m.walkover_team ?? '');
    setSProtest(m.protest ?? ''); setSProtestStatus(m.protest_status ?? '');
  };
  const saveScore = async (m: Match) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('arena_matches').update({
      home_score: sWo ? null : (sHome === '' ? null : parseInt(sHome)),
      away_score: sWo ? null : (sAway === '' ? null : parseInt(sAway)),
      walkover_team: sWo,
      protest: sProtest.trim(),
      protest_status: sProtest.trim() ? (sProtestStatus || 'inlämnad') : '',
      report: sReport,
      reported_by: u?.user?.id ?? null,
      reported_at: new Date().toISOString(),
      // Tabellen raknar bara avslutade matcher
      status: 'finished'
    }).eq('id', m.id);
    setScoreFor(null); load();
  };
  const setReferee = async (m: Match, id: string) => {
    await supabase.from('arena_matches').update({ referee_id: id || null }).eq('id', m.id);
    load();
  };

  const removeMatch = async (m: Match) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('arena_matches').delete().eq('id', m.id); load();
  };
  const setMatchStatus = async (id: string, status: string) => {
    if (status === 'cancelled') {
      const reason = window.prompt('Varför ställs matchen in? Orsaken skickas till personalen på planen.', '');
      if (reason === null) return;
      await supabase.from('arena_matches').update({ status, change_reason: reason.trim() }).eq('id', id);
      load();
      return;
    }
    await supabase.from('arena_matches').update({ status }).eq('id', id);
    load();
  };
  const addLog = async () => {
    if (!sEntry) return;
    await supabase.from('security_logs').insert({ arena_id: arena.id, entry: sEntry, severity: sSev, logged_by: userId });
    setSEntry(''); setSSev('low'); load();
  };
  const addCount = async () => {
    if (!cCount) return;
    await supabase.from('crowd_counts').insert({ arena_id: arena.id, count: parseInt(cCount) || 0, noted_by: userId });
    setCCount(''); load();
  };
  const latestCount = crowd[0]?.count ?? null;

  return (
    <>
      <Link href="/arenas" className="btn btn-sm btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={14} /> {tr('back')}
      </Link>
      <h1 className="page-title">{arena.name}</h1>
      <div className="page-sub">
        {arena.address ?? ''} · {arena.surface_count} {tn.labels.playingAreas.toLowerCase()}
        {tn.has('map') && (
          <> · <Link href={`/map?p=arena:${arena.id}`} className="map-link"><MapPin size={13} /> Visa på kartan</Link></>
        )}
      </div>

      <EmergencyCard table="arenas" id={arena.id} />

      <div className="tabs">
        <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>{tr('matchesLbl')} <span className="mono">{matches.filter((m) => m.status !== 'finished' && m.status !== 'cancelled').length}</span></button>
        <button className={`tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>{tr('securityLog')}</button>
        <button className={`tab ${tab === 'crowd' ? 'active' : ''}`} onClick={() => setTab('crowd')}>{tr('crowd')}</button>
        <button className={`tab ${tab === 'checklists' ? 'active' : ''}`} onClick={() => setTab('checklists')}>{tr('checklists')}</button>
      </div>

      {tab === 'matches' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">{tn.labels.playingArea}</label><input className="input" value={mSurf} onChange={(e) => setMSurf(e.target.value)} /></div>
            <div><label className="label">{tr('homeTeam')}</label><input className="input" value={mHome} onChange={(e) => setMHome(e.target.value)} /></div>
            <div><label className="label">{tr('awayTeam')}</label><input className="input" value={mAway} onChange={(e) => setMAway(e.target.value)} /></div>
            <div><label className="label">{tr('category')}</label><input className="input" value={mCat} onChange={(e) => setMCat(e.target.value)} /></div>
            <div><label className="label">Grupp</label><input className="input" value={mGroup} onChange={(e) => setMGroup(e.target.value)} placeholder="t.ex. Grupp A" /></div>
            <div><label className="label">{tn.labels.matchStart}</label><input className="input" type="datetime-local" value={mTime} onChange={(e) => setMTime(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addMatch}>{tr('addMatch')}</button>
          </div>
          <div className="list">
            {matches.map((m) => (
              <div key={m.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{m.home_team} — {m.away_team}</div>
                    <div className="li-meta mono">
                      {m.surface_label} · {tn.labels.matchStart} {fmt(m.starts_at)}
                      {m.category ? ` · ${m.category}` : ''}
                      {m.group_name ? ` · ${m.group_name}` : ''}
                    </div>
                    {m.original_starts_at && (
                      <div className="li-meta" style={{ color: 'var(--danger)' }}>
                        Flyttad från {fmt(m.original_starts_at)}{m.change_reason ? ` · ${m.change_reason}` : ''}
                      </div>
                    )}
                    {!m.original_starts_at && m.status === 'cancelled' && m.change_reason && (
                      <div className="li-meta" style={{ color: 'var(--danger)' }}>Inställd · {m.change_reason}</div>
                    )}
                    {m.protest && (
                      <div className="li-meta">
                        <span className={`badge ${m.protest_status === 'godkänd' ? 'b-resolved' : m.protest_status === 'avslagen' ? 'b-finished' : 'b-medium'}`}>
                          Protest · {m.protest_status || 'inlämnad'}
                        </span> {m.protest}
                      </div>
                    )}
                    {(m.home_score !== null || m.walkover_team) && (
                      <div className="li-title" style={{ marginTop: 3 }}>
                        {m.walkover_team
                          ? `Walkover · ${m.walkover_team} uteblev`
                          : `${m.home_score} – ${m.away_score}`}
                      </div>
                    )}
                    {m.referee_id && (
                      <div className="li-meta">
                        Domare: {referees.find((r) => r.id === m.referee_id)?.full_name ?? '—'}
                      </div>
                    )}
                  </div>
                  <span className={`badge b-${m.status}`}>{m.status === 'ongoing' && <span className="pulse" />}{msLabel(m.status)}</span>
                </div>
                <div className="li-actions">
                  {MATCH_STATUSES.filter((s) => s !== m.status).map((s) => (
                    <button key={s} className="btn btn-sm" onClick={() => setMatchStatus(m.id, s)}>{msLabel(s)}</button>
                  ))}
                  <button className="btn btn-sm btn-primary" onClick={() => openScore(m)}>Resultat</button>
                  {referees.length > 0 && (
                    <select className="select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                      value={m.referee_id ?? ''} onChange={(e) => setReferee(m, e.target.value)}>
                      <option value="">Domare: ingen</option>
                      {referees.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                    </select>
                  )}
                  <button className="btn btn-sm" onClick={() => openEditMatch(m)}>{tr('edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeMatch(m)}>{tr('deleteLbl')}</button>
                </div>
                {scoreFor === m.id && (
                  <div className="inline-form cols" style={{ marginTop: 10, marginBottom: 0 }}>
                    <div>
                      <label className="label">{m.home_team}</label>
                      <input className="input" inputMode="numeric" value={sHome} disabled={!!sWo}
                        onChange={(e) => setSHome(e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <div>
                      <label className="label">{m.away_team}</label>
                      <input className="input" inputMode="numeric" value={sAway} disabled={!!sWo}
                        onChange={(e) => setSAway(e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <div>
                      <label className="label">Walkover</label>
                      <select className="select" value={sWo} onChange={(e) => setSWo(e.target.value)}>
                        <option value="">Nej</option>
                        <option value={m.home_team}>{m.home_team} uteblev</option>
                        <option value={m.away_team}>{m.away_team} uteblev</option>
                      </select>
                    </div>
                    <div style={{ flex: 2 }}>
                      <label className="label">Matchrapport</label>
                      <input className="input" value={sReport} onChange={(e) => setSReport(e.target.value)} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label className="label">Protest</label>
                      <input className="input" value={sProtest} onChange={(e) => setSProtest(e.target.value)} placeholder="Lämna tomt om ingen protest" />
                    </div>
                    {sProtest.trim() && (
                      <div>
                        <label className="label">Protestens status</label>
                        <select className="select" value={sProtestStatus || 'inlämnad'} onChange={(e) => setSProtestStatus(e.target.value)}>
                          <option value="inlämnad">Inlämnad</option>
                          <option value="godkänd">Godkänd</option>
                          <option value="avslagen">Avslagen</option>
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => setScoreFor(null)}>{tr('cancel')}</button>
                      <button className="btn btn-sm btn-primary" onClick={() => saveScore(m)}>{tr('save')}</button>
                    </div>
                  </div>
                )}

                {editM?.id === m.id && (
                  <div className="inline-form cols" style={{ marginTop: 10, marginBottom: 0 }}>
                    <div><label className="label">{tn.labels.playingArea}</label><input className="input" value={emSurf} onChange={(e) => setEmSurf(e.target.value)} /></div>
                    <div><label className="label">{tr('homeTeam')}</label><input className="input" value={emHome} onChange={(e) => setEmHome(e.target.value)} /></div>
                    <div><label className="label">{tr('awayTeam')}</label><input className="input" value={emAway} onChange={(e) => setEmAway(e.target.value)} /></div>
                    <div><label className="label">{tr('category')}</label><input className="input" value={emCat} onChange={(e) => setEmCat(e.target.value)} /></div>
                    <div><label className="label">{tn.labels.matchStart}</label><input className="input" type="datetime-local" value={emTime} onChange={(e) => setEmTime(e.target.value)} /></div>
                    <div><label className="label">{tr('riskLbl')}</label>
                      <select className="select" value={emRisk} onChange={(e) => setEmRisk(e.target.value)}>
                        <option value="green">{tr('riskGreen')}</option>
                        <option value="yellow">{tr('riskYellow')}</option>
                        <option value="red">{tr('riskRed')}</option>
                      </select>
                    </div>
                    <div><label className="label">{tr('notes')}</label><input className="input" value={emRiskNote} onChange={(e) => setEmRiskNote(e.target.value)} /></div>
                    <div><label className="label">Grupp</label><input className="input" value={emGroup} onChange={(e) => setEmGroup(e.target.value)} /></div>
                    <div style={{ flex: 2 }}><label className="label">Orsak till ändring</label><input className="input" value={emReason} onChange={(e) => setEmReason(e.target.value)} placeholder="Skickas till personalen om tiden ändras" /></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => setEditM(null)}>{tr('cancel')}</button>
                      <button className="btn btn-sm btn-primary" onClick={saveMatch}>{tr('save')}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {matches.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}

      {tab === 'security' && (
        <>
          <div className="inline-form cols">
            <div style={{ gridColumn: 'span 2' }}><label className="label">{tr('addEntry')}</label><input className="input" value={sEntry} onChange={(e) => setSEntry(e.target.value)} /></div>
            <div><label className="label">{tr('severity')}</label>
              <select className="select" value={sSev} onChange={(e) => setSSev(e.target.value)}>
                {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{sevLabel(s)}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={addLog}>{tr('addEntry')}</button>
          </div>
          <div className="list">
            {logs.map((l) => (
              <div key={l.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{l.entry}</div>
                    <div className="li-meta mono">{fmt(l.created_at)}</div>
                  </div>
                  <span className={`badge b-${l.severity}`}>{sevLabel(l.severity)}</span>
                </div>
              </div>
            ))}
            {logs.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
          </div>
        </>
      )}

      {tab === 'crowd' && (
        <>
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 24 }}>
            <div className="big-num">{latestCount ?? '–'}</div>
            <div className="kpi-lbl">{tr('latestCount')}{crowd[0] ? ` · ${fmt(crowd[0].created_at)}` : ''}</div>
          </div>
          <div className="inline-form cols">
            <div><label className="label">{tr('countLbl')}</label><input className="input" type="number" value={cCount} onChange={(e) => setCCount(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addCount}>{tr('newCount')}</button>
          </div>
          <div className="list">
            {crowd.map((c) => (
              <div key={c.id} className="list-item">
                <div className="li-head">
                  <div className="li-title mono">{c.count}</div>
                  <div className="li-meta mono">{fmt(c.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'checklists' && <ChecklistRuns locationType="arena" locationId={arena.id} userId={userId} />}
    </>
  );
}
