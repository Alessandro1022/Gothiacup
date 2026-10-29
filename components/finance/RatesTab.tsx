'use client';
// Timpris per roll. Personalkostnaden bokas när ett pass checkas ut:
// passets timmar gånger rollens timpris. Per ROLL, aldrig per person – en
// timpeng per individ är en löneuppgift och hör inte hemma här.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ROLE_GROUPS, ROLE_LABELS, type Role } from '@/lib/types';

const kr = (n: number) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n) + ' kr';

export default function RatesTab({ canWrite, onSaved }: { canWrite: boolean; onSaved?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [booked, setBooked] = useState<{ amount: number; n: number }>({ amount: 0, n: 0 });
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from('role_rates').select('role,hourly_rate'),
      supabase.from('cost_entries').select('amount').eq('source_table', 'shifts')
    ]);
    if (r.error) setErr(r.error.message);
    const map: Record<string, number> = {};
    for (const x of (r.data ?? []) as { role: string; hourly_rate: number }[]) map[x.role] = Number(x.hourly_rate);
    setRates(map);
    setDraft(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v ? String(v) : ''])));
    const rows = (c.data ?? []) as { amount: number }[];
    setBooked({ amount: rows.reduce((s, x) => s + Number(x.amount), 0), n: rows.length });
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const save = async (role: Role) => {
    const raw = (draft[role] ?? '').replace(',', '.').trim();
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) { setErr('Timpriset måste vara ett tal.'); return; }
    if ((rates[role] ?? 0) === value) return;
    setErr('');
    const { error } = await supabase.from('role_rates')
      .upsert({ role, hourly_rate: value }, { onConflict: 'tenant_id,role' });
    if (error) { setErr(error.message); return; }
    setSaved(role);
    setTimeout(() => setSaved((s) => (s === role ? null : s)), 1800);
    await load();
    onSaved?.();
  };

  if (loading) return <div className="page-sub">Laddar timpriser…</div>;

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 12 }}>
        Personalkostnaden bokas när ett pass checkas ut: timmar gånger rollens
        timpris. Sätts eller ändras ett pris räknas rollens avslutade pass om.
        {booked.n > 0 && <> Hittills {kr(booked.amount)} från {booked.n} pass.</>}
      </div>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      {ROLE_GROUPS.map((g) => (
        <div key={g.label} className="card" style={{ marginBottom: 10 }}>
          <div className="li-meta" style={{ marginTop: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 11 }}>
            {g.label}
          </div>
          {g.roles.map((r) => (
            <div key={r} className="rate-row">
              <span>{ROLE_LABELS[r]}</span>
              {canWrite ? (
                <span className="rate-input">
                  <input className="input" inputMode="decimal" value={draft[r] ?? ''} placeholder="0"
                    aria-label={`Timpris ${ROLE_LABELS[r]}`}
                    onChange={(e) => setDraft((d) => ({ ...d, [r]: e.target.value.replace(/[^\d.,]/g, '') }))}
                    onBlur={() => save(r)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                  <span className="li-meta" style={{ marginTop: 0 }}>{saved === r ? 'sparat' : 'kr/h'}</span>
                </span>
              ) : (
                <b>{rates[r] ? `${rates[r]} kr/h` : '—'}</b>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
