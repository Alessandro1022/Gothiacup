'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';
import { tierOf, type Role } from '@/lib/types';

type Inc = { id: string; title: string; severity: string; status: string; created_at: string };
type Task = { id: string; title: string; status: string; priority: string };
type Shift = { id: string; starts_at: string; ends_at: string; status: string; role_note: string | null };

export default function DashboardClient({ role, userId }: { role: Role; userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [kpi, setKpi] = useState({ open: 0, critical: 0, tasks: 0, schools: 0, arenas: 0, teamsIn: 0 });
  const [latest, setLatest] = useState<Inc[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myInc, setMyInc] = useState<Inc[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (tier >= 3) {
      const [o, c, t, s, a, ti, l] = await Promise.all([
        supabase.from('incidents').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('severity', 'critical').neq('status', 'resolved'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('arenas').select('id', { count: 'exact', head: true }),
        supabase.from('team_assignments').select('id', { count: 'exact', head: true }).eq('status', 'checked_in'),
        supabase.from('incidents').select('id,title,severity,status,created_at').order('created_at', { ascending: false }).limit(5)
      ]);
      setKpi({ open: o.count ?? 0, critical: c.count ?? 0, tasks: t.count ?? 0, schools: s.count ?? 0, arenas: a.count ?? 0, teamsIn: ti.count ?? 0 });
      setLatest((l.data ?? []) as Inc[]);
    } else {
      const [t, i, sh] = await Promise.all([
        supabase.from('tasks').select('id,title,status,priority').eq('assigned_to', userId).neq('status', 'done').order('created_at', { ascending: false }),
        supabase.from('incidents').select('id,title,severity,status,created_at').or(`reported_by.eq.${userId},assigned_to.eq.${userId}`).order('created_at', { ascending: false }).limit(10),
        supabase.from('shifts').select('id,starts_at,ends_at,status,role_note').eq('user_id', userId).gte('ends_at', new Date().toISOString()).order('starts_at').limit(5)
      ]);
      setMyTasks((t.data ?? []) as Task[]);
      setMyInc((i.data ?? []) as Inc[]);
      setMyShifts((sh.data ?? []) as Shift[]);
    }
    setLoading(false);
  }, [supabase, tier, userId]);

  useEffect(() => {
    load();
    const ch = supabase.channel('dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  const sevKey = (s: string) => (s === 'low' ? 'sevLow' : s === 'medium' ? 'sevMedium' : s === 'high' ? 'sevHigh' : 'sevCritical');
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <h1 className="page-title">{tr('dashboard')}</h1>
      <div className="page-sub"><span className="pulse" />{tenant.event.name} · {tenant.event.city} · {tr('live').toLowerCase()}</div>

      {tier >= 3 ? (
        <>
          <div className="cards">
            <div className="card"><div className="kpi-num">{kpi.open}</div><div className="kpi-lbl">{tr('openIncidents')}</div></div>
            <div className="card"><div className={`kpi-num ${kpi.critical > 0 ? 'danger' : ''}`}>{kpi.critical}</div><div className="kpi-lbl">{tr('criticalNow')}</div></div>
            <div className="card"><div className="kpi-num">{kpi.tasks}</div><div className="kpi-lbl">{tr('openTasks')}</div></div>
            <div className="card"><div className="kpi-num">{kpi.teamsIn}</div><div className="kpi-lbl">{tr('teamsIn')}</div></div>
            <div className="card"><div className="kpi-num">{kpi.schools}</div><div className="kpi-lbl">{tenant.labels.schools}</div></div>
            <div className="card"><div className="kpi-num">{kpi.arenas}</div><div className="kpi-lbl">{tenant.labels.playingAreas}</div></div>
          </div>

          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{tr('latestIncidents')}</h2>
          <div className="list">
            {latest.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {latest.map((i) => (
              <div key={i.id} className="list-item">
                <div className="li-head">
                  <div className="li-title">{i.title}</div>
                  <span className={`badge b-${i.severity}`}>{tr(sevKey(i.severity))}</span>
                </div>
                <div className="li-meta mono">{fmt(i.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 16, margin: '6px 0 10px' }}>{tr('myShifts')}</h2>
          <div className="list" style={{ marginBottom: 22 }}>
            {myShifts.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {myShifts.map((s) => (
              <div key={s.id} className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title mono">{fmt(s.starts_at)} → {fmt(s.ends_at)}</div>
                    {s.role_note && <div className="li-meta">{s.role_note}</div>}
                  </div>
                  <span className={`badge b-${s.status}`}>{s.status === 'planned' ? tr('shPlanned') : s.status === 'checked_in' ? tr('tmCheckedIn') : s.status === 'checked_out' ? tr('tmCheckedOut') : tr('shMissed')}</span>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 16, margin: '6px 0 10px' }}>{tr('myTasks')}</h2>
          <div className="list" style={{ marginBottom: 22 }}>
            {myTasks.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {myTasks.map((t) => (
              <div key={t.id} className="list-item">
                <div className="li-head">
                  <div className="li-title">{t.title}</div>
                  <span className={`badge b-${t.status}`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{tr('myIncidents')}</h2>
          <div className="list">
            {myInc.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {myInc.map((i) => (
              <div key={i.id} className="list-item">
                <div className="li-head">
                  <div className="li-title">{i.title}</div>
                  <span className={`badge b-${i.severity}`}>{tr(sevKey(i.severity))}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
