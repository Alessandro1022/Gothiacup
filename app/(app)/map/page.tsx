import { createClient } from '@/lib/supabase/server';
import MapClient from '@/components/map/MapClient';
import { tierOf, type Role } from '@/lib/types';
import { redirect } from 'next/navigation';
import { assertModule } from '@/lib/modules';

// ?p=school:<id> eller ?p=arena:<id> öppnar kartan på den platsen
type Props = { searchParams: Promise<{ p?: string }> };

export default async function MapPage({ searchParams }: Props) {
  await assertModule('map');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const tier = tierOf((profile?.role ?? 'volunteer') as Role);
  if (tier < 2) redirect('/dashboard');

  const { p } = await searchParams;
  const focus = typeof p === 'string' && /^(school|arena):[0-9a-f-]{36}$/i.test(p) ? p : null;

  // Samma gräns som databasen: bara administratörer (tier 5+) får ändra
  // var en plats ligger.
  return <MapClient canEdit={tier >= 5} focus={focus} />;
}
