import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/dashboard/DashboardClient';
import type { Role } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single();

  return <DashboardClient role={(profile?.role ?? 'volunteer') as Role} userId={user!.id} />;
}
