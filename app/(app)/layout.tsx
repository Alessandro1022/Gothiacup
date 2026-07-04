import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import type { Role } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  return (
    <Shell role={(profile?.role ?? 'volunteer') as Role} name={profile?.full_name || user.email || ''}>
      {children}
    </Shell>
  );
}
