import FinanceClient from '@/components/finance/FinanceClient';
import { assertModule } from '@/lib/modules';

export default async function FinancePage() {
  await assertModule('finance');
  return <FinanceClient />;
}
