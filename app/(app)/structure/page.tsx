import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StructureClient from '@/components/structure/StructureClient';
import { tierOf, type Role } from '@/lib/types';

import { assertModule } from '@/lib/modules';
export default async function StructurePage() {
  await assertModule('structure');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  if (tierOf((profile?.role ?? 'volunteer') as Role) < 5) redirect('/dashboard');
  return <StructureClient />;
}
