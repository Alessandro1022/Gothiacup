import { createClient } from '@/lib/supabase/server';
import StaffingClient, { type StaffingTab } from '@/components/staffing/StaffingClient';
import { assertModule } from '@/lib/modules';
import type { Role } from '@/lib/types';

const TABS: StaffingTab[] = ['brister', 'jour', 'franvaro', 'tillganglighet', 'intro'];

// ?tab=jour öppnar jourschemat direkt, t.ex. från jourpanelen i topbaren
export default async function StaffingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await assertModule('shifts');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const { tab } = await searchParams;
  const initialTab = TABS.includes(tab as StaffingTab) ? (tab as StaffingTab) : undefined;
  return <StaffingClient userId={user!.id} role={(profile?.role ?? 'volunteer') as Role} initialTab={initialTab} />;
}
