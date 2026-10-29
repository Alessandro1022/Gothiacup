import { createClient } from '@/lib/supabase/server';
import ArenasClient, { type ArenasTab } from '@/components/arenas/ArenasClient';
import { assertModule } from '@/lib/modules';
import { tierOf, type Role } from '@/lib/types';

const TABS: ArenasTab[] = ['platser', 'domare', 'tabeller'];

export default async function ArenasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await assertModule('arenas');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const { tab } = await searchParams;
  return (
    <ArenasClient
      canManage={tierOf((profile?.role ?? 'volunteer') as Role) >= 4}
      initialTab={TABS.includes(tab as ArenasTab) ? (tab as ArenasTab) : 'platser'}
    />
  );
}
