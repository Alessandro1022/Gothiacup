import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PlatformClient from '@/components/platform/PlatformClient';
import { tierOf, type Role } from '@/lib/types';

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  if (tierOf((profile?.role ?? 'volunteer') as Role) < 6) redirect('/dashboard');
  return <PlatformClient />;
}
