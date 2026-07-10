import { createClient } from '@/lib/supabase/server';
import ChatClient from '@/components/chat/ChatClient';
import type { Role } from '@/lib/types';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  return <ChatClient userId={user!.id} role={(profile?.role ?? 'volunteer') as Role} />;
}
