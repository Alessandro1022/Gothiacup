'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

type Arena = { id: string; name: string; address: string | null; surface_count: number; area_id: string | null };
type Area = { id: string; name: string };
type Match = { arena_id: string; status: string };

export default function ArenasClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [a, ar, m] = await Promise.all([
        supabase.from('arenas').select('id,name,address,surface_count,area_id').order('name'),
        supabase.from('areas').select('id,name'),
        supabase.from('arena_matches').select('arena_id,status')
      ]);
      setArenas((a.data ?? []) as Arena[]);
      setAreas((ar.data ?? []) as Area[]);
      setMatches((m.data ?? []) as Match[]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? '—';

  return (
    <>
      <h1 className="page-title">{tenant.labels.playingAreas}</h1>
      <div className="page-sub">matcher · säkerhet · publik · checklistor</div>

      <div className="grid-cards">
        {arenas.map((a) => {
          const live = matches.filter((m) => m.arena_id === a.id && m.status === 'ongoing').length;
          const upcoming = matches.filter((m) => m.arena_id === a.id && m.status === 'scheduled').length;
          return (
            <Link key={a.id} href={`/arenas/${a.id}`} className="card link-card">
              <div className="li-head">
                <div className="li-title">{a.name}</div>
                {live > 0 && <span className="badge b-ongoing"><span className="pulse" />{live} {tr('live')}</span>}
              </div>
              <div className="li-meta">{areaName(a.area_id)}{a.address ? ` · ${a.address}` : ''}</div>
              <div className="stat-row">
                <div className="stat"><div className="num">{a.surface_count}</div><div className="lbl">{tenant.labels.playingAreas}</div></div>
                <div className="stat"><div className="num">{upcoming}</div><div className="lbl">{tr('matchesLbl')}</div></div>
              </div>
            </Link>
          );
        })}
        {arenas.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
