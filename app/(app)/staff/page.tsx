import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StaffClient from '@/components/staff/StaffClient';
import { tierOf, type Role } from '@/lib/types';

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile?.role ?? 'volunteer') as Role;

  // Sidan kräver koordinator+ (tier 4); redigering kräver admin+ (RLS skyddar ändå)
  if (tierOf(role) < 4) redirect('/dashboard');
  return <StaffClient viewerRole={role} />;
}
