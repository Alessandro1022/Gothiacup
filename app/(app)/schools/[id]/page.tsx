import { createClient } from '@/lib/supabase/server';
import SchoolDetailClient from '@/components/schools/SchoolDetailClient';

// Next 15: params är async
export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: school } = await supabase.from('schools').select('id,name,address,capacity').eq('id', id).single();

  if (!school) return <div className="page-sub">Hittades inte.</div>;
  return <SchoolDetailClient school={school} userId={user!.id} />;
}
