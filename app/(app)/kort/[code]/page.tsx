import { createClient } from '@/lib/supabase/server';
import { assertModule } from '@/lib/modules';
import { BadgeCheck, UserRound } from 'lucide-react';

// Deltagarkort, slås upp på kortets kod. Ligger innanför inloggningen med
// flit: kortet berättar vilket boende en i regel minderårig deltagare bor
// på, och det ska bara personal kunna se.
type Card = {
  full_name: string;
  role: 'spelare' | 'ledare';
  team_name: string;
  club_name: string;
  age_class: string;
  country: string | null;
  school_name: string;
  tenant_name: string;
  checked_in: boolean;
};

export default async function CardPage({ params }: { params: Promise<{ code: string }> }) {
  await assertModule('schools');
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('participant_by_card', { code }).maybeSingle();
  const c = data as Card | null;

  if (!c) {
    return (
      <div className="panel" style={{ maxWidth: 420, margin: '32px auto', padding: 24 }}>
        <h1 className="page-title" style={{ marginTop: 0 }}>Okänt kort</h1>
        <p className="muted" style={{ margin: 0 }}>
          Koden hör inte till någon deltagare i din turnering.
        </p>
      </div>
    );
  }

  const rows: [string, string][] = [
    ['Lag', c.team_name],
    ['Förening', c.club_name || '—'],
    ['Klass', c.age_class || '—'],
    ['Land', c.country || '—'],
    ['Boende', c.school_name]
  ];

  return (
    <div className="panel" style={{ maxWidth: 420, margin: '24px auto', padding: 0, overflow: 'hidden' }}>
      <div style={{ background: 'var(--panel-2)', color: '#fff', padding: '18px 20px' }}>
        <div style={{ opacity: 0.75, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          {c.tenant_name}
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 9 }}>
          <UserRound size={21} /> {c.full_name}
        </div>
        <div style={{ opacity: 0.8, fontSize: 13.5, marginTop: 2 }}>
          {c.role === 'ledare' ? 'Ledare' : 'Spelare'}
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="stat-row">
            <span>{k}</span><b>{v}</b>
          </div>
        ))}

        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          background: c.checked_in ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--bg)'
        }}>
          <BadgeCheck size={17} style={{ color: c.checked_in ? 'var(--ok)' : 'var(--muted)' }} />
          <b style={{ fontSize: 13.5 }}>{c.checked_in ? 'Incheckad' : 'Inte incheckad'}</b>
        </div>
      </div>
    </div>
  );
}
