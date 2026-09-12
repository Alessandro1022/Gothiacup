'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

// Databasen räknar beläggningen. Klienten hämtar en rad per skola.
type Stat = {
  id: string; name: string; address: string | null; capacity: number; area_id: string | null;
  in_house: number; teams_in: number; teams_expected: number;
  open_issues: number; open_incidents: number;
};
type Area = { id: string; name: string };

export default function SchoolsClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [rows, setRows] = useState<Stat[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [s, a] = await Promise.all([
        supabase.from('school_stats').select('*').order('name'),
        supabase.from('areas').select('id,name').order('name')
      ]);
      setRows((s.data ?? []) as Stat[]);
      setAreas((a.data ?? []) as Area[]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? '—';

  const visible = useMemo(
    () => rows.filter((s) =>
      (area === '' || s.area_id === area) &&
      (q === '' || s.name.toLowerCase().includes(q.toLowerCase()))
    ),
    [rows, q, area]
  );

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  return (
    <>
      <h1 className="page-title">{tenant.labels.schools}</h1>
      <div className="page-sub">boende · incheckning · nycklar · nattrond</div>

      <input className="input" style={{ marginBottom: 10 }} placeholder={tr('searchLbl')}
        value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        <button className={`chip ${area === '' ? 'active' : ''}`} onClick={() => setArea('')}>{tr('all')}</button>
        {areas.map((a) => (
          <button key={a.id} className={`chip ${area === a.id ? 'active' : ''}`} onClick={() => setArea(a.id)}>
            {a.name}
          </button>
        ))}
      </div>

      <div className="grid-cards">
        {visible.map((s) => {
          const pct = s.capacity > 0 ? Math.min(100, Math.round((s.in_house / s.capacity) * 100)) : 0;
          return (
            <Link key={s.id} href={`/schools/${s.id}`} className="card link-card">
              <div className="li-head">
                <div className="li-title">{s.name}</div>
                {s.open_incidents > 0 && <span className="badge b-critical">{s.open_incidents}</span>}
              </div>
              <div className="li-meta">{areaName(s.area_id)}{s.address ? ` · ${s.address}` : ''}</div>

              <div className="stat-row" style={{ marginTop: 8 }}>
                <span>{tr('capacity')}</span><b>{s.in_house}/{s.capacity} · {pct}%</b>
              </div>
              <div className="prog" style={{ marginBottom: 8 }}><div style={{ width: `${pct}%` }} /></div>

              <div className="stat-row"><span>{tr('teamsIn')}</span><b>{s.teams_in}</b></div>
              {s.teams_expected > 0 && (
                <div className="stat-row"><span>{tr('tmExpected')}</span><b>{s.teams_expected}</b></div>
              )}
              {s.open_issues > 0 && (
                <div className="stat-row"><span>{tr('openIssues')}</span><b>{s.open_issues}</b></div>
              )}
            </Link>
          );
        })}
        {visible.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
