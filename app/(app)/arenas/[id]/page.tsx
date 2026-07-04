import { createClient } from '@/lib/supabase/server';
import ArenaDetailClient from '@/components/arenas/ArenaDetailClient';

// Next 15: params är async
export default async function ArenaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: arena } = await supabase.from('arenas').select('id,name,address,surface_count').eq('id', id).single();

  if (!arena) return <div className="page-sub">Hittades inte.</div>;
  return <ArenaDetailClient arena={arena} userId={user!.id} />;
}
