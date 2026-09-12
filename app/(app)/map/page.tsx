import { createClient } from '@/lib/supabase/server';
import MapClient from '@/components/map/MapClient';
import { tierOf, type Role } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  if (tierOf((profile?.role ?? 'volunteer') as Role) < 2) redirect('/dashboard');
  return <MapClient />;
}
