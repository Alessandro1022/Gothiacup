'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

type Area = { id: string; name: string; description: string | null };
type Place = { id: string; name: string; area_id: string | null };
type Inc = { location_type: string | null; location_id: string | null };
type Issue = { school_id: string };
type Team = { school_id: string; status: string };

export default function AreasClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [areas, setAreas] = useState<Area[]>([]);
  const [schools, setSchools] = useState<Place[]>([]);
  const [arenas, setArenas] = useState<Place[]>([]);
  const [incidents, setIncidents] = useState<Inc[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, s, ar, i, ri, t] = await Promise.all([
      supabase.from('areas').select('id,name,description').order('name'),
      supabase.from('schools').select('id,name,area_id'),
      supabase.from('arenas').select('id,name,area_id'),
      supabase.from('incidents').select('location_type,location_id').neq('status', 'resolved'),
      supabase.from('room_issues').select('school_id').neq('status', 'resolved'),
      supabase.from('team_assignments').select('school_id,status').eq('status', 'checked_in')
    ]);
    setAreas((a.data ?? []) as Area[]);
    setSchools((s.data ?? []) as Place[]);
    setArenas((ar.data ?? []) as Place[]);
    setIncidents((i.data ?? []) as Inc[]);
    setIssues((ri.data ?? []) as Issue[]);
    setTeams((t.data ?? []) as Team[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel('areas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_issues' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assignments' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  const statsFor = (areaId: string) => {
    const sIds = schools.filter((s) => s.area_id === areaId).map((s) => s.id);
    const aIds = arenas.filter((a) => a.area_id === areaId).map((a) => a.id);
    const openInc = incidents.filter((i) =>
      (i.location_type === 'school' && i.location_id && sIds.includes(i.location_id)) ||
      (i.location_type === 'arena' && i.location_id && aIds.includes(i.location_id))
    ).length;
    const openIssues = issues.filter((i) => sIds.includes(i.school_id)).length;
    const teamsIn = teams.filter((t) => sIds.includes(t.school_id)).length;
    return { schools: sIds.length, arenas: aIds.length, openInc, openIssues, teamsIn };
  };

  return (
    <>
      <h1 className="page-title">{tenant.labels.areas}</h1>
      <div className="page-sub"><span className="pulse" />{tr('live').toLowerCase()} · aggregerad status per {tenant.labels.area.toLowerCase()}</div>

      <div className="grid-cards">
        {areas.map((a) => {
          const st = statsFor(a.id);
          return (
            <div key={a.id} className="card link-card">
              <div className="li-head">
                <div className="li-title">{a.name}</div>
                {st.openInc > 0 && <span className="badge b-critical">{st.openInc} {tr('incidents').toLowerCase()}</span>}
              </div>
              {a.description && <div className="li-meta">{a.description}</div>}
              <div className="stat-row">
                <div className="stat"><div className="num">{st.schools}</div><div className="lbl">{tenant.labels.schools}</div></div>
                <div className="stat"><div className="num">{st.arenas}</div><div className="lbl">{tenant.labels.playingAreas}</div></div>
                <div className="stat"><div className="num">{st.teamsIn}</div><div className="lbl">{tr('teamsIn')}</div></div>
                <div className="stat"><div className="num">{st.openIssues}</div><div className="lbl">{tr('openIssues')}</div></div>
              </div>
              <div className="li-actions">
                <Link href="/schools" className="btn btn-sm">{tenant.labels.schools}</Link>
                <Link href="/arenas" className="btn btn-sm">{tenant.labels.playingAreas}</Link>
              </div>
            </div>
          );
        })}
        {areas.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
