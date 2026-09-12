'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

// Databasen räknar, klienten ritar. En rad per område i stället för alla lag.
type AreaStat = {
  id: string; name: string; description: string | null;
  n_schools: number; n_arenas: number; teams_in: number;
  in_house: number; capacity: number; open_issues: number; open_incidents: number;
};

export default function AreasClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [rows, setRows] = useState<AreaStat[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('area_stats').select('*').order('name');
    setRows((data ?? []) as AreaStat[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    // Fördröjd omladdning: många ändringar i rad ger en enda uppdatering
    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, 1500);
    };
    const ch = supabase.channel('areas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_issues' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assignments' }, bump)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  return (
    <>
      <h1 className="page-title">{tenant.labels.areas}</h1>
      <div className="page-sub">
        <span className="pulse" />{tr('live').toLowerCase()} · aggregerad status per {tenant.labels.area.toLowerCase()}
      </div>

      <div className="grid-cards">
        {rows.map((a) => {
          const pct = a.capacity > 0 ? Math.min(100, Math.round((a.in_house / a.capacity) * 100)) : 0;
          return (
            <div key={a.id} className="card link-card">
              <div className="li-head">
                <div className="li-title">{a.name}</div>
                {a.open_incidents > 0 && (
                  <span className="badge b-critical">{a.open_incidents} {tr('incidents').toLowerCase()}</span>
                )}
              </div>
              {a.description && <div className="li-meta">{a.description}</div>}

              <div className="stat-row"><span>{tenant.labels.schools}</span><b>{a.n_schools}</b></div>
              <div className="stat-row"><span>{tenant.labels.playingAreas}</span><b>{a.n_arenas}</b></div>
              <div className="stat-row"><span>{tr('teamsIn')}</span><b>{a.teams_in}</b></div>
              <div className="stat-row"><span>{tr('openIssues')}</span><b>{a.open_issues}</b></div>
              <div className="stat-row" style={{ marginBottom: 6 }}>
                <span>{tr('capacity')}</span><b>{a.in_house}/{a.capacity} · {pct}%</b>
              </div>
              <div className="prog"><div style={{ width: `${pct}%` }} /></div>

              <div className="li-actions">
                <Link href="/schools" className="btn btn-sm">{tenant.labels.schools}</Link>
                <Link href="/arenas" className="btn btn-sm">{tenant.labels.playingAreas}</Link>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
