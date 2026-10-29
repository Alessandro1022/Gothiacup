'use client';
// Ekonomi. Modulen räknar ingenting själv — den summerar vad transport,
// lager och måltider rapporterar in. Poster med ett ursprung går att följa
// tillbaka till uppdraget, måltiden eller rörelsen som skapade dem, och det
// är det som gör läckor hittbara.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, TrendingDown, Receipt, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';

type Row = {
  category: string; planned: number; actual: number;
  deviation: number; pct_of_budget: number | null; entries: number;
};
type Team = {
  team_assignment_id: string; team_name: string; club_name: string;
  registered: number | null; cost: number; revenue: number;
  cost_per_participant: number | null;
};
type Entry = {
  id: string; category: string; amount: number; entry_date: string;
  description: string; source_table: string;
};
type Budget = { id: string; category: string; name: string; planned: number };

const CATS = ['personal', 'boende', 'transport', 'material', 'maltider', 'ovrigt', 'intakt'] as const;
const CAT_LABEL: Record<string, string> = {
  personal: 'Personal', boende: 'Boende', transport: 'Transport',
  material: 'Material', maltider: 'Måltider', ovrigt: 'Övrigt', intakt: 'Intäkter'
};

const kr = (n: number) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n) + ' kr';

export default function FinanceClient() {
  const supabase = createClient();
  const tn = useTenant();
  const canWrite = tn.canWrite('finance');

  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [tab, setTab] = useState<'budget' | 'poster' | 'lag'>('budget');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [bCat, setBCat] = useState<string>('transport');
  const [bName, setBName] = useState('');
  const [bAmount, setBAmount] = useState('');

  const [eCat, setECat] = useState<string>('ovrigt');
  const [eDesc, setEDesc] = useState('');
  const [eAmount, setEAmount] = useState('');

  const load = useCallback(async () => {
    const [b, t, e, bl] = await Promise.all([
      supabase.from('budget_vs_actual').select('*'),
      supabase.from('cost_per_team').select('*').order('cost', { ascending: false }),
      supabase.from('cost_entries').select('id,category,amount,entry_date,description,source_table')
        .order('entry_date', { ascending: false }).limit(100),
      supabase.from('budget_lines').select('id,category,name,planned').order('category')
    ]);
    setRows((b.data ?? []) as Row[]);
    setTeams((t.data ?? []) as Team[]);
    setEntries((e.data ?? []) as Entry[]);
    setBudgets((bl.data ?? []) as Budget[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const addBudget = async () => {
    if (!bName.trim() || !bAmount) return;
    setErr('');
    const { error } = await supabase.from('budget_lines').insert({
      category: bCat, name: bName.trim(), planned: Number(bAmount)
    });
    if (error) { setErr(error.message); return; }
    setBName(''); setBAmount(''); load();
  };

  const addEntry = async () => {
    if (!eDesc.trim() || !eAmount) return;
    setErr('');
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('cost_entries').insert({
      category: eCat, description: eDesc.trim(), amount: Number(eAmount),
      created_by: u?.user?.id ?? null
    });
    if (error) { setErr(error.message); return; }
    setEDesc(''); setEAmount(''); load();
  };

  const costRows = useMemo(
    () => rows.filter((r) => r.category !== 'intakt' && (r.planned > 0 || r.actual > 0)),
    [rows]
  );
  const income = rows.find((r) => r.category === 'intakt');

  const totalPlanned = costRows.reduce((s, r) => s + Number(r.planned), 0);
  const totalActual = costRows.reduce((s, r) => s + Number(r.actual), 0);

  // Svinn är den vanligaste läckan, så den lyfts fram för sig
  const waste = entries
    .filter((e) => e.description.startsWith('Svinn'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const lost = entries
    .filter((e) => e.description.startsWith('Förlorat') || e.description.startsWith('Skadat'))
    .reduce((s, e) => s + Number(e.amount), 0);

  if (loading) return <div className="page-sub">Laddar…</div>;

  return (
    <>
      <h1 className="page-title">Ekonomi</h1>
      <div className="page-sub">
        {kr(totalActual)} av {kr(totalPlanned)} budgeterat
        {income && Number(income.actual) > 0 && ` · ${kr(Number(income.actual))} in`}
        {!canWrite && ' · du har läsbehörighet'}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      {(waste > 0 || lost > 0) && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <TrendingDown size={16} style={{ color: 'var(--danger)' }} /> Läckor
          </div>
          <div className="li-meta">Kostnader utan motsvarande nytta</div>
          {waste > 0 && (
            <div className="stat-row" style={{ marginTop: 8 }}>
              <span>Matsvinn</span><b style={{ color: 'var(--danger)' }}>{kr(waste)}</b>
            </div>
          )}
          {lost > 0 && (
            <div className="stat-row">
              <span>Skadat och förlorat materiel</span>
              <b style={{ color: 'var(--danger)' }}>{kr(lost)}</b>
            </div>
          )}
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'budget' ? 'active' : ''}`} onClick={() => setTab('budget')}>
          Budget
        </button>
        <button className={`tab ${tab === 'poster' ? 'active' : ''}`} onClick={() => setTab('poster')}>
          Poster <span className="mono">{entries.length}</span>
        </button>
        <button className={`tab ${tab === 'lag' ? 'active' : ''}`} onClick={() => setTab('lag')}>
          Per lag <span className="mono">{teams.length}</span>
        </button>
      </div>

      {tab === 'budget' && (
        <>
          {canWrite && (
            <div className="inline-form cols">
              <div>
                <label className="label">Kategori</label>
                <select className="select" value={bCat} onChange={(e) => setBCat(e.target.value)}>
                  {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label className="label">Budgetrad</label>
                <input className="input" value={bName} onChange={(e) => setBName(e.target.value)}
                  placeholder="Transporter" />
              </div>
              <div>
                <label className="label">Belopp</label>
                <input className="input" inputMode="numeric" value={bAmount}
                  onChange={(e) => setBAmount(e.target.value.replace(/\D/g, ''))} />
              </div>
              <button className="btn btn-primary" onClick={addBudget} disabled={!bName.trim() || !bAmount}>
                <Plus size={15} /> Lägg till
              </button>
            </div>
          )}

          <div className="grid-cards">
            {costRows.map((r) => {
              const over = Number(r.deviation) > 0;
              const pct = r.pct_of_budget;
              return (
                <div key={r.category} className="card">
                  <div className="li-head">
                    <div className="li-title">{CAT_LABEL[r.category] ?? r.category}</div>
                    {over && <span className="badge b-critical">över budget</span>}
                  </div>
                  <div className="li-meta">{r.entries} poster</div>

                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <span>Budget</span><b>{kr(Number(r.planned))}</b>
                  </div>
                  <div className="stat-row">
                    <span>Utfall</span>
                    <b style={over ? { color: 'var(--danger)' } : undefined}>{kr(Number(r.actual))}</b>
                  </div>
                  <div className="stat-row">
                    <span>Avvikelse</span>
                    <b style={over ? { color: 'var(--danger)' } : { color: 'var(--ok)' }}>
                      {over ? '+' : ''}{kr(Number(r.deviation))}
                    </b>
                  </div>

                  {pct !== null && (
                    <div className="prog" style={{ marginTop: 8 }}>
                      <div style={{
                        width: `${Math.min(100, Number(pct))}%`,
                        background: over ? 'var(--danger)' : undefined
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
            {costRows.length === 0 && (
              <div className="page-sub">
                Ingen budget lagd än. Utfallet fylls av sig självt när transport,
                måltider och lager får priser.
              </div>
            )}
          </div>

          {budgets.length > 0 && (
            <div className="list" style={{ marginTop: 14 }}>
              {budgets.map((b) => (
                <div key={b.id} className="list-item" style={{ padding: '8px 0' }}>
                  <div className="li-head">
                    <div>
                      <div style={{ fontSize: 14 }}>{b.name}</div>
                      <div className="li-meta">{CAT_LABEL[b.category] ?? b.category}</div>
                    </div>
                    <b className="mono">{kr(Number(b.planned))}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'poster' && (
        <>
          {canWrite && (
            <div className="inline-form cols">
              <div>
                <label className="label">Kategori</label>
                <select className="select" value={eCat} onChange={(e) => setECat(e.target.value)}>
                  {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label className="label">Beskrivning</label>
                <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
              </div>
              <div>
                <label className="label">Belopp</label>
                <input className="input" inputMode="numeric" value={eAmount}
                  onChange={(e) => setEAmount(e.target.value.replace(/\D/g, ''))} />
              </div>
              <button className="btn btn-primary" onClick={addEntry} disabled={!eDesc.trim() || !eAmount}>
                <Receipt size={15} /> Bokför
              </button>
            </div>
          )}

          <div className="list">
            {entries.map((e) => (
              <div key={e.id} className="list-item" style={{ padding: '9px 0' }}>
                <div className="li-head">
                  <div>
                    <div style={{ fontSize: 14 }}>{e.description || CAT_LABEL[e.category]}</div>
                    <div className="li-meta">
                      {e.entry_date} · {CAT_LABEL[e.category] ?? e.category}
                      {e.source_table !== 'manuell' && ' · automatisk'}
                    </div>
                  </div>
                  <b className="mono" style={e.category === 'intakt' ? { color: 'var(--ok)' } : undefined}>
                    {e.category === 'intakt' ? '+' : ''}{kr(Number(e.amount))}
                  </b>
                </div>
              </div>
            ))}
            {entries.length === 0 && <div className="page-sub">Inga poster än.</div>}
          </div>
        </>
      )}

      {tab === 'lag' && (
        <div className="grid-cards">
          {teams.filter((t) => Number(t.cost) > 0 || Number(t.revenue) > 0).map((t) => (
            <div key={t.team_assignment_id} className="card">
              <div className="li-head">
                <div className="li-title">{t.team_name}</div>
              </div>
              <div className="li-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={13} /> {t.registered ?? 0} deltagare
                {t.club_name ? ` · ${t.club_name}` : ''}
              </div>
              <div className="stat-row" style={{ marginTop: 8 }}>
                <span>Kostnad</span><b>{kr(Number(t.cost))}</b>
              </div>
              {Number(t.revenue) > 0 && (
                <div className="stat-row">
                  <span>Intäkt</span><b style={{ color: 'var(--ok)' }}>{kr(Number(t.revenue))}</b>
                </div>
              )}
              {t.cost_per_participant !== null && (
                <div className="stat-row">
                  <span>Per deltagare</span><b>{kr(Number(t.cost_per_participant))}</b>
                </div>
              )}
            </div>
          ))}
          {teams.filter((t) => Number(t.cost) > 0 || Number(t.revenue) > 0).length === 0 && (
            <div className="page-sub">
              Inga kostnader knutna till lag än. De fylls när transporter och boenden
              kopplas till ett lag.
            </div>
          )}
        </div>
      )}
    </>
  );
}
