'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

type School = { id: string; name: string; address: string | null; capacity: number; area_id: string | null };
type Area = { id: string; name: string };
type Team = { school_id: string; group_size: number };

export default function SchoolsClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [schools, setSchools] = useState<School[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [teamsIn, setTeamsIn] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [s, a, t] = await Promise.all([
        supabase.from('schools').select('id,name,address,capacity,area_id').order('name'),
        supabase.from('areas').select('id,name'),
        supabase.from('team_assignments').select('school_id,group_size').eq('status', 'checked_in')
      ]);
      setSchools((s.data ?? []) as School[]);
      setAreas((a.data ?? []) as Area[]);
      setTeamsIn((t.data ?? []) as Team[]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? '—';

  return (
    <>
      <h1 className="page-title">{tenant.labels.schools}</h1>
      <div className="page-sub">boende · incheckning · nycklar · nattrond</div>

      <div className="grid-cards">
        {schools.map((s) => {
          const inHouse = teamsIn.filter((t) => t.school_id === s.id).reduce((sum, t) => sum + t.group_size, 0);
          const pct = s.capacity > 0 ? Math.min(100, Math.round((inHouse / s.capacity) * 100)) : 0;
          return (
            <Link key={s.id} href={`/schools/${s.id}`} className="card link-card">
              <div className="li-title">{s.name}</div>
              <div className="li-meta">{areaName(s.area_id)}{s.address ? ` · ${s.address}` : ''}</div>
              <div className="stat-row">
                <div className="stat"><div className="num">{inHouse}/{s.capacity}</div><div className="lbl">{tr('capacity')}</div></div>
              </div>
              <div className="prog"><div style={{ width: `${pct}%` }} /></div>
            </Link>
          );
        })}
        {schools.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
