import { createClient } from '@/lib/supabase/server';
import NewsClient from '@/components/news/NewsClient';
import type { Role } from '@/lib/types';

import { assertModule } from '@/lib/modules';
export default async function NewsPage() {
  await assertModule('news');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  return <NewsClient userId={user!.id} role={(profile?.role ?? 'volunteer') as Role} />;
}
