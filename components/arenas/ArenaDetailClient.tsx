'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

type Arena = { id: string; name: string; address: string | null; surface_count: number };
type Match = { id: string; surface_label: string; home_team: string; away_team: string; category: string | null; starts_at: string; status: string };
type SecLog = { id: string; entry: string; severity: string; created_at: string };
type Crowd = { id: string; count: number; created_at: string };
type Template = { id: string; name: string; items: string[] };
type Run = { id: string; template_name: string; status: string; created_at: string };
type Item = { id: string; run_id: string; label: string; done: boolean };

type Tab = 'matches' | 'security' | 'crowd' | 'checklists';
const MATCH_STATUSES = ['scheduled', 'ongoing', 'finished', 'cancelled'] as const;

export default function ArenaDetailClient({ arena, userId }: { arena: Arena; userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [logs, setLogs] = useState<SecLog[]>([]);
  const [crowd, setCrowd] = useState<Crowd[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Formulär
  const [mSurf, setMSurf] = useState(''); const [mHome, setMHome] = useState(''); const [mAway, setMAway] = useState('');
  const [mCat, setMCat] = useState(''); const [mTime, setMTime] = useState('');
  const [sEntry, setSEntry] = useState(''); const [sSev, setSSev] = useState('low');
  const [cCount, setCCount] = useState('');
  const [tmplId, setTmplId] = useState('');

  const load = useCallback(async () => {
    const [m, s, c, t, r] = await Promise.all([
      supabase.from('arena_matches').select('id,surface_label,home_team,away_team,category,starts_at,status').eq('arena_id', arena.id).order('starts_at'),
      supabase.from('security_logs').select('id,entry,severity,created_at').eq('arena_id', arena.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('crowd_counts').select('id,count,created_at').eq('arena_id', arena.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('checklist_templates').select('id,name,items').eq('location_type', 'arena'),
      supabase.from('checklist_runs').select('id,template_name,status,created_at').eq('location_type', 'arena').eq('location_id', arena.id).order('created_at', { ascending: false }).limit(10)
    ]);
    setMatches((m.data ?? []) as Match[]);
    setLogs((s.data ?? []) as SecLog[]);
    setCrowd((c.data ?? []) as Crowd[]);
    setTemplates((t.data ?? []) as Template[]);
    const runList = (r.data ?? []) as Run[];
    setRuns(runList);
    if (runList.length) {
      const { data: it } = await supabase.from('checklist_items').select('id,run_id,label,done')
        .in('run_id', runList.map((x) => x.id)).order('sort');
      setItems((it ?? []) as Item[]);
    } else setItems([]);
  }, [supabase, arena.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`arena-${arena.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_logs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crowd_counts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, load)
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
      arena_id: arena.id, surface_label: mSurf || `${tenant.labels.playingArea} 1`,
      home_team: mHome, away_team: mAway, category: mCat || null,
      starts_at: new Date(mTime).toISOString()
    });
    setMSurf(''); setMHome(''); setMAway(''); setMCat(''); setMTime('');
    load();
  };
  const setMatchStatus = async (id: string, status: string) => {
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
  const startRun = async () => {
    const tmpl = templates.find((t) => t.id === tmplId);
    if (!tmpl) return;
    const { data: run } = await supabase.from('checklist_runs')
      .insert({ template_id: tmpl.id, template_name: tmpl.name, location_type: 'arena', location_id: arena.id, started_by: userId })
      .select('id').single();
    if (run) {
      await supabase.from('checklist_items').insert(
        tmpl.items.map((label, i) => ({ run_id: run.id, label, sort: i }))
      );
    }
    setTmplId(''); load();
  };
  const toggleItem = async (it: Item) => {
    await supabase.from('checklist_items').update({
      done: !it.done, done_by: !it.done ? userId : null, done_at: !it.done ? new Date().toISOString() : null
    }).eq('id', it.id);
    // Klarmarkera körningen automatiskt om alla punkter är klara
    const runItems = items.map((x) => x.id === it.id ? { ...x, done: !it.done } : x).filter((x) => x.run_id === it.run_id);
    if (runItems.every((x) => x.done)) {
      await supabase.from('checklist_runs').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', it.run_id);
    } else {
      await supabase.from('checklist_runs').update({ status: 'open', completed_at: null }).eq('id', it.run_id);
    }
    load();
  };

  const latestCount = crowd[0]?.count ?? null;

  return (
    <>
      <Link href="/arenas" className="btn btn-sm btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={14} /> {tr('back')}
      </Link>
      <h1 className="page-title">{arena.name}</h1>
      <div className="page-sub">{arena.address ?? ''} · {arena.surface_count} {tenant.labels.playingAreas.toLowerCase()}</div>

      <div className="tabs">
        <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>{tr('matchesLbl')} <span className="mono">{matches.filter((m) => m.status !== 'finished' && m.status !== 'cancelled').length}</span></button>
        <button className={`tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>{tr('securityLog')}</button>
        <button className={`tab ${tab === 'crowd' ? 'active' : ''}`} onClick={() => setTab('crowd')}>{tr('crowd')}</button>
        <button className={`tab ${tab === 'checklists' ? 'active' : ''}`} onClick={() => setTab('checklists')}>{tr('checklists')}</button>
      </div>

      {tab === 'matches' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">{tenant.labels.playingArea}</label><input className="input" value={mSurf} onChange={(e) => setMSurf(e.target.value)} /></div>
            <div><label className="label">{tr('homeTeam')}</label><input className="input" value={mHome} onChange={(e) => setMHome(e.target.value)} /></div>
            <div><label className="label">{tr('awayTeam')}</label><input className="input" value={mAway} onChange={(e) => setMAway(e.target.value)} /></div>
            <div><label className="label">{tr('category')}</label><input className="input" value={mCat} onChange={(e) => setMCat(e.target.value)} /></div>
            <div><label className="label">{tenant.labels.matchStart}</label><input className="input" type="datetime-local" value={mTime} onChange={(e) => setMTime(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={addMatch}>{tr('addMatch')}</button>
          </div>
          <div className="list">
            {matches.map((m) => (
              <div key={m.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title">{m.home_team} — {m.away_team}</div>
                    <div className="li-meta mono">{m.surface_label} · {tenant.labels.matchStart} {fmt(m.starts_at)}{m.category ? ` · ${m.category}` : ''}</div>
                  </div>
                  <span className={`badge b-${m.status}`}>{m.status === 'ongoing' && <span className="pulse" />}{msLabel(m.status)}</span>
                </div>
                <div className="li-actions">
                  {MATCH_STATUSES.filter((s) => s !== m.status).map((s) => (
                    <button key={s} className="btn btn-sm" onClick={() => setMatchStatus(m.id, s)}>{msLabel(s)}</button>
                  ))}
                </div>
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

      {tab === 'checklists' && (
        <>
          <div className="inline-form cols">
            <div><label className="label">{tr('checklists')}</label>
              <select className="select" value={tmplId} onChange={(e) => setTmplId(e.target.value)}>
                <option value="">—</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" disabled={!tmplId} onClick={startRun}>{tr('startRun')}</button>
          </div>
          {runs.map((r) => {
            const runItems = items.filter((i) => i.run_id === r.id);
            const doneCount = runItems.filter((i) => i.done).length;
            return (
              <div key={r.id} style={{ marginBottom: 18 }}>
                <div className="row-between">
                  <div className="li-title">{r.template_name} <span className="li-meta mono">{fmt(r.created_at)}</span></div>
                  <span className={`badge b-${r.status}`}>{r.status === 'done' ? tr('tDone') : `${doneCount}/${runItems.length}`}</span>
                </div>
                <div className="prog" style={{ marginBottom: 10 }}><div style={{ width: runItems.length ? `${(doneCount / runItems.length) * 100}%` : '0%' }} /></div>
                <div className="list">
                  {runItems.map((it) => (
                    <label key={it.id} className={`check-row ${it.done ? 'done' : ''}`}>
                      <input type="checkbox" checked={it.done} onChange={() => toggleItem(it)} /> {it.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {runs.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
        </>
      )}
    </>
  );
}
