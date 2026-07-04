import { createClient } from '@/lib/supabase/server';
import TasksClient from '@/components/tasks/TasksClient';

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <TasksClient userId={user!.id} />;
}
