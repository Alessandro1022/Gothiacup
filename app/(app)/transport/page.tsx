import TransportClient from '@/components/transport/TransportClient';
import { assertModule } from '@/lib/modules';

export default async function TransportPage() {
  await assertModule('transport');
  return <TransportClient />;
}
