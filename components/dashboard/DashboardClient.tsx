'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';
import { tierOf, type Role } from '@/lib/types';

type Inc = { id: string; title: string; severity: string; status: string; created_at: string };
type Task = { id: string; title: string; status: string; priority: string };

export default function DashboardClient({ role, userId }: { role: Role; userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [kpi, setKpi] = useState({ open: 0, critical: 0, tasks: 0, schools: 0, arenas: 0 });
  const [latest, setLatest] = useState<Inc[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myInc, setMyInc] = useState<Inc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (tier >= 3) {
      const [o, c, t, s, a, l] = await Promise.all([
        supabase.from('incidents').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('severity', 'critical').neq('status', 'resolved'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('arenas').select('id', { count: 'exact', head: true }),
        supabase.from('incidents').select('id,title,severity,status,created_at').order('created_at', { ascending: false }).limit(5)
      ]);
      setKpi({ open: o.count ?? 0, critical: c.count ?? 0, tasks: t.count ?? 0, schools: s.count ?? 0, arenas: a.count ?? 0 });
      setLatest((l.data ?? []) as Inc[]);
    } else {
      const [t, i] = await Promise.all([
        supabase.from('tasks').select('id,title,status,priority').eq('assigned_to', userId).neq('status', 'done').order('created_at', { ascending: false }),
        supabase.from('incidents').select('id,title,severity,status,created_at').or(`reported_by.eq.${userId},assigned_to.eq.${userId}`).order('created_at', { ascending: false }).limit(10)
      ]);
      setMyTasks((t.data ?? []) as Task[]);
      setMyInc((i.data ?? []) as Inc[]);
    }
    setLoading(false);
  }, [supabase, tier, userId]);

  useEffect(() => {
    load();
    const ch = supabase.channel('dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

const sevKey = (
  s: string
): 'sevLow' | 'sevMedium' | 'sevHigh' | 'sevCritical' => {
  switch (s) {
    case 'low':
      return 'sevLow';
    case 'medium':
      return 'sevMedium';
    case 'high':
      return 'sevHigh';
    default:
      return 'sevCritical';
  }
};
  return (
    <>
      <h1 className="page-title">{tr('dashboard')}</h1>
      <div className="page-sub">{tenant.event.name} · {tenant.event.city}</div>

      {tier >= 3 ? (
        <>
          <div className="cards">
            <div className="card"><div className="kpi-num">{kpi.open}</div><div className="kpi-lbl">{tr('openIncidents')}</div></div>
            <div className="card"><div className={`kpi-num ${kpi.critical > 0 ? 'danger' : ''}`}>{kpi.critical}</div><div className="kpi-lbl">{tr('criticalNow')}</div></div>
            <div className="card"><div className="kpi-num">{kpi.tasks}</div><div className="kpi-lbl">{tr('openTasks')}</div></div>
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
                <div className="li-meta mono">{new Date(i.created_at).toLocaleString('sv-SE')}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
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
