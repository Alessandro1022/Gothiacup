import Link from 'next/link';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { FEATURE_LABELS, type FeatureKey } from '@/lib/features';

// Visas när någon försöker öppna en modul som inte ingår i turneringens paket.
export default async function LockedPage({
  searchParams
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const key = m as FeatureKey | undefined;
  const label = key && FEATURE_LABELS[key] ? FEATURE_LABELS[key] : 'Modulen';

  const supabase = await createClient();
  const { data } = await supabase.rpc('my_tenant_row').maybeSingle();
  const tenant = data as { name?: string; plan_name?: string } | null;

  return (
    <div className="panel" style={{ maxWidth: 520, margin: '32px auto', padding: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Lock size={20} style={{ color: 'var(--muted)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>{label} ingår inte</h1>
      </div>

      <p className="muted" style={{ margin: '0 0 18px' }}>
        {tenant?.plan_name
          ? `${tenant.name ?? 'Turneringen'} kör paketet ${tenant.plan_name}, och ${label.toLowerCase()} ingår inte i det.`
          : `${label} är avstängd för den här turneringen.`}
        {' '}Kontakta den som administrerar plattformen för att lägga till den.
      </p>

      <Link className="btn btn-primary" href="/dashboard">Till översikten</Link>
    </div>
  );
}
