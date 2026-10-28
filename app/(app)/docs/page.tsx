import { createClient } from '@/lib/supabase/server';
import DocsClient from '@/components/docs/DocsClient';
import type { Role } from '@/lib/types';

import { assertModule } from '@/lib/modules';
export default async function DocsPage() {
  await assertModule('docs');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  return <DocsClient role={(profile?.role ?? 'volunteer') as Role} />;
}
