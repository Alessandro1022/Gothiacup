import { createClient } from '@/lib/supabase/server';
import ShiftsClient from '@/components/shifts/ShiftsClient';
import type { Role } from '@/lib/types';

import { assertModule } from '@/lib/modules';
export default async function ShiftsPage() {
  await assertModule('shifts');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  return <ShiftsClient userId={user!.id} role={(profile?.role ?? 'volunteer') as Role} />;
}
