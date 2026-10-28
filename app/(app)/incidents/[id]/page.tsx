import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import IncidentDetailClient from '@/components/incidents/IncidentDetailClient';
import type { Role } from '@/lib/types';

import { assertModule } from '@/lib/modules';
export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  await assertModule('incidents');
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const { data: incident } = await supabase.from('incidents').select('id').eq('id', id).single();
  if (!incident) notFound();
  return <IncidentDetailClient incidentId={id} userId={user!.id} role={(profile?.role ?? 'volunteer') as Role} />;
}
