import { createClient } from '@/lib/supabase/server';
import IncidentsClient from '@/components/incidents/IncidentsClient';

import { assertModule } from '@/lib/modules';
export default async function IncidentsPage() {
  await assertModule('incidents');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <IncidentsClient userId={user!.id} />;
}
