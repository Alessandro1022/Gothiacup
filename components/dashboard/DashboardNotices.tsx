'use client';
// Saker som väntar på den inloggade, överst på översikten. Visas bara när
// det finns något att göra – en tom ruta är bara brus.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { appliesTo } from '@/components/staffing/IntroTab';
import type { Role } from '@/lib/types';

export default function DashboardNotices({ role, userId }: { role: Role; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [introLeft, setIntroLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [i, d] = await Promise.all([
        supabase.from('onboarding_items').select('id,roles,required'),
        supabase.from('onboarding_done').select('item_id').eq('user_id', userId)
      ]);
      // Saknas tabellerna (del 18 inte körd) visas inget
      if (cancelled || i.error) return;
      const done = new Set(((d.data ?? []) as { item_id: string }[]).map((x) => x.item_id));
      const items = (i.data ?? []) as { id: string; roles: string[] | null; required: boolean }[];
      setIntroLeft(items.filter((it) => it.required && appliesTo(it, role) && !done.has(it.id)).length);
    })();
    return () => { cancelled = true; };
  }, [supabase, role, userId]);

  if (introLeft === 0) return null;

  return (
    <Link href="/staffing?tab=intro" className="notice-card">
      <GraduationCap size={20} />
      <span style={{ flex: 1 }}>
        <b>Introduktion</b>
        <span className="li-meta" style={{ display: 'block', marginTop: 1 }}>
          {introLeft} {introLeft === 1 ? 'punkt' : 'punkter'} kvar att läsa innan du börjar
        </span>
      </span>
      <ChevronRight size={18} />
    </Link>
  );
}
