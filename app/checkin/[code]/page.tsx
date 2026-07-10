import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckinClient from '@/components/shifts/CheckinClient';

export default async function CheckinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <CheckinClient code={code} userId={user.id} />;
}
