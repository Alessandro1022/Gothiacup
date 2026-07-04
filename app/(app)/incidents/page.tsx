import { createClient } from '@/lib/supabase/server';
import IncidentsClient from '@/components/incidents/IncidentsClient';

export default async function IncidentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <IncidentsClient userId={user!.id} />;
}
