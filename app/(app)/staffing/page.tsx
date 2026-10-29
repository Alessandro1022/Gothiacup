import { createClient } from '@/lib/supabase/server';
import StaffingClient from '@/components/staffing/StaffingClient';
import { assertModule } from '@/lib/modules';
import type { Role } from '@/lib/types';

export default async function StaffingPage() {
  await assertModule('shifts');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  return <StaffingClient userId={user!.id} role={(profile?.role ?? 'volunteer') as Role} />;
}
