import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReportsClient from '@/components/reports/ReportsClient';
import { tierOf, type Role } from '@/lib/types';

import { assertModule } from '@/lib/modules';
export default async function ReportsPage() {
  await assertModule('reports');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  if (tierOf((profile?.role ?? 'volunteer') as Role) < 3) redirect('/dashboard');
  return <ReportsClient />;
}
