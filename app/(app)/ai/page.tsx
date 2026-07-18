import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AiClient from '@/components/ai/AiClient';
import { tierOf, type Role } from '@/lib/types';

export default async function AiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile?.role ?? 'volunteer') as Role;
  if (tierOf(role) < 2) redirect('/dashboard');
  return <AiClient role={role} />;
}
