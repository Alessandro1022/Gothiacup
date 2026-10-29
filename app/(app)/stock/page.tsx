import StockClient from '@/components/stock/StockClient';
import { assertModule } from '@/lib/modules';

export default async function StockPage() {
  await assertModule('stock');
  return <StockClient />;
}
