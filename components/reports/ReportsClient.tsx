'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

type Inc = { severity: string; status: string; created_at: string };
type SchoolRow = { id: string; name: string; capacity: number };
type TeamRow = { school_id: string; group_size: number; status: string };

export default function ReportsClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [inc, setInc] = useState<Inc[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [shifts, setShifts] = useState<{ active: number; checkedIn: number }>({ active: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const nowIso = new Date().toISOString();
      const [i, s, t, a, c] = await Promise.all([
        supabase.from('incidents').select('severity,status,created_at').gte('created_at', weekAgo),
        supabase.from('schools').select('id,name,capacity'),
        supabase.from('team_assignments').select('school_id,group_size,status'),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).lte('starts_at', nowIso).gte('ends_at', nowIso),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).lte('starts_at', nowIso).gte('ends_at', nowIso).eq('status', 'checked_in')
      ]);
      setInc((i.data ?? []) as Inc[]);
      setSchools((s.data ?? []) as SchoolRow[]);
      setTeams((t.data ?? []) as TeamRow[]);
      setShifts({ active: a.count ?? 0, checkedIn: c.count ?? 0 });
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  // Per dag (7 dagar)
  const days: { label: string; count: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(Date.now() - d * 864e5);
    const key = day.toISOString().slice(0, 10);
    days.push({
      label: day.toLocaleDateString('sv-SE', { weekday: 'short' }),
      count: inc.filter((x) => x.created_at.slice(0, 10) === key).length
    });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const sev = ['critical', 'high', 'medium', 'low'].map((s) => ({
    key: s, count: inc.filter((x) => x.severity === s).length
  }));
  const maxSev = Math.max(1, ...sev.map((x) => x.count));
  const sevLabel = (s: string) => s === 'low' ? tr('sevLow') : s === 'medium' ? tr('sevMedium') : s === 'high' ? tr('sevHigh') : tr('sevCritical');

  const openC = inc.filter((x) => x.status !== 'resolved').length;
  const fill = shifts.active ? Math.round((shifts.checkedIn / shifts.active) * 100) : null;

  const occ = schools.map((s) => {
    const inHouse = teams.filter((t) => t.school_id === s.id && t.status === 'checked_in').reduce((a, t) => a + t.group_size, 0);
    return { name: s.name, pct: s.capacity ? Math.round((inHouse / s.capacity) * 100) : 0, inHouse, cap: s.capacity };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <>
      <h1 className="page-title">{tr('reports')}</h1>
      <div className="page-sub">{tenant.event.name} · BI</div>

      <div className="cards">
        <div className="card"><div className="kpi-num">{inc.length}</div><div className="kpi-lbl">{tr('perDay7')}</div></div>
        <div className="card"><div className={`kpi-num ${openC > 0 ? 'danger' : ''}`}>{openC}/{inc.length - openC}</div><div className="kpi-lbl">{tr('openVsResolved')}</div></div>
        <div className="card"><div className="kpi-num">{fill === null ? '–' : `${fill}%`}</div><div className="kpi-lbl">{tr('fillRate')}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{tr('perDay7')}</h2>
        {days.map((d, i) => (
          <div key={i} className="bar-row">
            <span>{d.label}</span>
            <div className="bar"><div style={{ width: `${(d.count / maxDay) * 100}%` }} /></div>
            <span className="mono">{d.count}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{tr('bySeverity')}</h2>
        {sev.map((s) => (
          <div key={s.key} className="bar-row">
            <span>{sevLabel(s.key)}</span>
            <div className={`bar ${s.key === 'critical' ? 'warn' : ''}`}><div style={{ width: `${(s.count / maxSev) * 100}%` }} /></div>
            <span className="mono">{s.count}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{tr('occupancyLbl')}</h2>
        {occ.map((o) => (
          <div key={o.name} className="bar-row">
            <span>{o.name}</span>
            <div className={`bar ${o.pct > 100 ? 'warn' : ''}`}><div style={{ width: `${Math.min(100, o.pct)}%` }} /></div>
            <span className="mono">{o.pct}%</span>
          </div>
        ))}
        {occ.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
