import AreasClient from '@/components/areas/AreasClient';
import { assertModule } from '@/lib/modules';

export default async function AreasPage() {
  await assertModule('areas');
  return <AreasClient />;
}
