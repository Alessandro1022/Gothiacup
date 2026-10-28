import { createClient } from '@/lib/supabase/server';
import TasksClient from '@/components/tasks/TasksClient';

import { assertModule } from '@/lib/modules';
export default async function TasksPage() {
  await assertModule('tasks');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <TasksClient userId={user!.id} />;
}
