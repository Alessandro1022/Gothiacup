import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HistoryClient from '@/components/history/HistoryClient';
import { tierOf, type Role } from '@/lib/types';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  if (tierOf((profile?.role ?? 'volunteer') as Role) < 4) redirect('/dashboard');
  return <HistoryClient />;
}
