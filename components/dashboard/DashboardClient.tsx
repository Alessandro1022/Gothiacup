'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
      setKpi({
        open: o.count ?? 0, critical: c.count ?? 0, tasks: t.count ?? 0,
        schools: s.count ?? 0, arenas: a.count ?? 0, teamsIn: ti.count ?? 0
      });
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

  if (loading) {
    return (
      <>
        <div className="skel" style={{ height: 26, width: 180, marginBottom: 10 }} />
        <div className="skel" style={{ height: 14, width: 260, marginBottom: 20 }} />
        <div className="cards">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" style={{ height: 88 }} />)}
        </div>
      </>
    );
  }

  const sevKey = (s: string) => (s === 'low' ? 'sevLow' : s === 'medium' ? 'sevMedium' : s === 'high' ? 'sevHigh' : 'sevCritical');
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const shLabel = (s: string) =>
    s === 'planned' ? tr('shPlanned') : s === 'checked_in' ? tr('tmCheckedIn')
      : s === 'checked_out' ? tr('tmCheckedOut') : tr('shMissed');

  return (
    <>
      <h1 className="page-title">{tr('dashboard')}</h1>
      <div className="page-sub">
        <span className="pulse" />{tenant.event.name} · {tenant.event.city} · {tr('live').toLowerCase()}
      </div>

      {tier >= 3 ? (
        <>
          {/* Varje kort leder vidare */}
          <div className="cards">
            <Link href="/incidents" className="card">
              <div className="kpi-num">{kpi.open}</div>
              <div className="kpi-lbl">{tr('openIncidents')}</div>
            </Link>
            <Link href="/incidents" className="card">
              <div className={`kpi-num ${kpi.critical > 0 ? 'danger' : ''}`}>{kpi.critical}</div>
              <div className="kpi-lbl">{tr('criticalNow')}</div>
            </Link>
            <Link href="/tasks" className="card">
              <div className="kpi-num">{kpi.tasks}</div>
              <div className="kpi-lbl">{tr('openTasks')}</div>
            </Link>
            <Link href="/schools" className="card">
              <div className="kpi-num">{kpi.teamsIn}</div>
              <div className="kpi-lbl">{tr('teamsIn')}</div>
            </Link>
            <Link href="/schools" className="card">
              <div className="kpi-num">{kpi.schools}</div>
              <div className="kpi-lbl">{tenant.labels.schools}</div>
            </Link>
            <Link href="/arenas" className="card">
              <div className="kpi-num">{kpi.arenas}</div>
              <div className="kpi-lbl">{tenant.labels.playingAreas}</div>
            </Link>
          </div>

          <div className="row-between" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 17 }}>{tr('latestIncidents')}</h2>
            <Link href="/incidents" className="btn btn-sm btn-ghost">{tr('all')} →</Link>
          </div>
          <div className="list">
            {latest.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {latest.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} className="list-item">
                <div className="li-head">
                  <div className="li-title">{i.title}</div>
                  <span className={`badge b-${i.severity}`}>{tr(sevKey(i.severity))}</span>
                </div>
                <div className="li-meta mono">{fmt(i.created_at)}</div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 17 }}>{tr('myShifts')}</h2>
            <Link href="/shifts" className="btn btn-sm btn-ghost">{tr('all')} →</Link>
          </div>
          <div className="list" style={{ marginBottom: 24 }}>
            {myShifts.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {myShifts.map((s) => (
              <Link key={s.id} href="/shifts" className="list-item">
                <div className="li-head">
                  <div>
                    <div className="li-title mono">{fmt(s.starts_at)} → {fmt(s.ends_at)}</div>
                    {s.role_note && <div className="li-meta">{s.role_note}</div>}
                  </div>
                  <span className={`badge b-${s.status}`}>{shLabel(s.status)}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="row-between" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 17 }}>{tr('myTasks')}</h2>
            <Link href="/tasks" className="btn btn-sm btn-ghost">{tr('all')} →</Link>
          </div>
          <div className="list" style={{ marginBottom: 24 }}>
            {myTasks.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {myTasks.map((t) => (
              <Link key={t.id} href="/tasks" className="list-item">
                <div className="li-head">
                  <div className="li-title">{t.title}</div>
                  <span className={`badge b-${t.status}`}>
                    {t.status === 'todo' ? tr('tTodo') : t.status === 'in_progress' ? tr('tInProgress') : tr('tDone')}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <h2 style={{ fontSize: 17, marginBottom: 10 }}>{tr('myIncidents')}</h2>
          <div className="list">
            {myInc.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
            {myInc.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} className="list-item">
                <div className="li-head">
                  <div className="li-title">{i.title}</div>
                  <span className={`badge b-${i.severity}`}>{tr(sevKey(i.severity))}</span>
                </div>
                <div className="li-meta mono">{fmt(i.created_at)}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
