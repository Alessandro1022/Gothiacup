'use client';
// Nödinfo för en plats: återsamlingsplats, närmaste vård och övrigt.
// Hör till platsen, inte till ett dokument – står det i en PDF hittar
// ingen det klockan två på natten.
import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Info = { assembly_point?: string; nearest_care?: string; emergency_note?: string };

export default function EmergencyCard({ table, id }: { table: 'schools' | 'arenas'; id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let cancelled = false;
    // select('*') så att kortet bara blir tomt, inte trasigt, utan del 17
    supabase.from(table).select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (!cancelled) setInfo((data ?? null) as Info | null);
    });
    return () => { cancelled = true; };
  }, [supabase, table, id]);

  if (!info || !(info.assembly_point || info.nearest_care || info.emergency_note)) return null;

  return (
    <div className="card emerg-card">
      <div className="li-title"><ShieldAlert size={14} /> Nödinfo</div>
      {info.assembly_point && <div className="stat-row"><span>Återsamling</span><b>{info.assembly_point}</b></div>}
      {info.nearest_care && <div className="stat-row"><span>Närmaste vård</span><b>{info.nearest_care}</b></div>}
      {info.emergency_note && <div style={{ fontSize: 13.5, marginTop: 4 }}>{info.emergency_note}</div>}
    </div>
  );
}
