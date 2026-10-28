import SchoolsClient from '@/components/schools/SchoolsClient';
import { assertModule } from '@/lib/modules';

export default async function SchoolsPage() {
  await assertModule('schools');
  return <SchoolsClient />;
}
