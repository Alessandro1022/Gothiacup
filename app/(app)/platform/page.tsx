import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PlatformClient from '@/components/platform/PlatformClient';

// Plattformsvyn är ägarens, inte varje turneringschefs. En innebandychef har
// också tier 6 – fast bara inom sin egen turnering – och ska inte kunna se
// eller skapa andras turneringar här.
export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('platform_owner').eq('id', user.id).maybeSingle();

  if (!profile?.platform_owner) redirect('/dashboard');
  return <PlatformClient />;
}
