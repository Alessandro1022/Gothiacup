import ArenasClient from '@/components/arenas/ArenasClient';
import { assertModule } from '@/lib/modules';

export default async function ArenasPage() {
  await assertModule('arenas');
  return <ArenasClient />;
}
