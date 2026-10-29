import MealsClient from '@/components/meals/MealsClient';
import { assertModule } from '@/lib/modules';

export default async function MealsPage() {
  await assertModule('meals');
  return <MealsClient />;
}
