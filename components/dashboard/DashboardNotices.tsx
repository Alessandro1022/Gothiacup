'use client';
// Saker som väntar på den inloggade, överst på översikten. Visas bara när
// det finns något att göra – en tom ruta är bara brus.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, ChevronRight, ClipboardCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { appliesTo } from '@/components/staffing/IntroTab';
import { tierOf, type Role } from '@/lib/types';

export default function DashboardNotices({ role, userId }: { role: Role; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [introLeft, setIntroLeft] = useState(0);
  const [lists, setLists] = useState<{ done: number; total: number } | null>(null);
  const isManager = tierOf(role) >= 4;

  useEffect(() => {
    let cancelled = false;

    // Introduktion som återstår för den egna rollen. Saknas tabellerna
    // (del 18 inte körd) visas inget.
    (async () => {
      const [i, d] = await Promise.all([
        supabase.from('onboarding_items').select('id,roles,required'),
        supabase.from('onboarding_done').select('item_id').eq('user_id', userId)
      ]);
      if (cancelled || i.error) return;
      const done = new Set(((d.data ?? []) as { item_id: string }[]).map((x) => x.item_id));
      const items = (i.data ?? []) as { id: string; roles: string[] | null; required: boolean }[];
      setIntroLeft(items.filter((it) => it.required && appliesTo(it, role) && !done.has(it.id)).length);
    })();

    // Ledningen: dagens checklistor. Körningens status kommer med del 22.
    if (isManager) {
      (async () => {
        const { data, error } = await supabase.from('checklist_due_today').select('run_status');
        if (cancelled || error || !data || data.length === 0) return;
        const rows = data as { run_status?: string | null }[];
        setLists({ done: rows.filter((r) => r.run_status === 'done').length, total: rows.length });
      })();
    }

    return () => { cancelled = true; };
  }, [supabase, role, userId, isManager]);

  if (introLeft === 0 && !lists) return null;

  return (
    <>
      {lists && (
        <Link href="/staffing?tab=checklistor" className={`notice-card ${lists.done === lists.total ? 'calm' : ''}`}>
          <ClipboardCheck size={20} />
          <span style={{ flex: 1 }}>
            <b>Checklistor idag</b>
            <span className="li-meta" style={{ display: 'block', marginTop: 1 }}>
              {lists.done} av {lists.total} klara
            </span>
          </span>
          <ChevronRight size={18} />
        </Link>
      )}
      {introLeft > 0 && (
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
      )}
    </>
  );
}
