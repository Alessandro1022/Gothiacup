'use client';
// Lager och material. Saldot räknas ur rörelsejournalen, aldrig ur en
// saldokolumn — en sådan driver förr eller senare isär från verkligheten
// och då går det inte att se var det gick fel.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, AlertTriangle, History, ArrowRightLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';

type Total = {
  item_id: string; name: string; unit: string; category: string;
  min_level: number; qr_code: string; total: number; under_grans: boolean;
};
type Balance = {
  item_id: string; location_name: string; location_type: string | null;
  location_id: string | null; qty: number;
};
type Move = {
  id: string; item_id: string; kind: string; qty: number; note: string;
  borrower: string; moved_at: string;
};
type Place = { id: string; name: string; kind: 'school' | 'arena' };

const KIND_LABEL: Record<string, string> = {
  inleverans: 'Inleverans', uttag: 'Uttag', utlan: 'Utlån', retur: 'Retur',
  skadad: 'Skadad', forlorad: 'Förlorad', inventering: 'Inventering', flytt: 'Flytt'
};

// Vilka fält varje rörelsetyp behöver, så formuläret inte visar brus
const NEEDS_TO = ['flytt'];
const NEEDS_BORROWER = ['utlan', 'retur'];

const CATEGORIES = ['boende', 'idrott', 'kontor', 'ovrigt'];

export default function StockClient() {
  const supabase = createClient();
  const tn = useTenant();
  const canWrite = tn.canWrite('stock');

  const [totals, setTotals] = useState<Total[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  // Ny artikel
  const [nName, setNName] = useState('');
  const [nUnit, setNUnit] = useState('st');
  const [nCat, setNCat] = useState('boende');
  const [nMin, setNMin] = useState('0');

  // Ny rörelse
  const [mItem, setMItem] = useState('');
  const [mKind, setMKind] = useState('inleverans');
  const [mQty, setMQty] = useState('');
  const [mFrom, setMFrom] = useState('');
  const [mTo, setMTo] = useState('');
  const [mWho, setMWho] = useState('');
  const [mNote, setMNote] = useState('');

  const load = useCallback(async () => {
    const [t, b, s, a, m] = await Promise.all([
      supabase.from('stock_totals').select('*').order('name'),
      supabase.from('stock_balances').select('*'),
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('arenas').select('id,name').order('name'),
      supabase.from('stock_movements')
        .select('id,item_id,kind,qty,note,borrower,moved_at')
        .order('moved_at', { ascending: false }).limit(60)
    ]);
    setTotals((t.data ?? []) as Total[]);
    setBalances((b.data ?? []) as Balance[]);
    setPlaces([
      ...((s.data ?? []) as { id: string; name: string }[]).map((x) => ({ ...x, kind: 'school' as const })),
      ...((a.data ?? []) as { id: string; name: string }[]).map((x) => ({ ...x, kind: 'arena' as const }))
    ]);
    setMoves((m.data ?? []) as Move[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel('stock-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addItem = async () => {
    if (!nName.trim()) return;
    setErr('');
    const { error } = await supabase.from('stock_items').insert({
      name: nName.trim(), unit: nUnit.trim() || 'st',
      category: nCat, min_level: parseInt(nMin) || 0
    });
    if (error) { setErr(error.message); return; }
    setNName(''); setNMin('0'); load();
  };

  const parsePlace = (v: string) =>
    v === '' ? { t: null, i: null } : { t: v.split(':')[0], i: v.split(':')[1] };

  const addMove = async () => {
    const qty = parseInt(mQty);
    if (!mItem || !qty || qty <= 0) { setErr('Välj artikel och ett antal större än noll.'); return; }
    if (NEEDS_TO.includes(mKind) && !mTo) { setErr('En flytt behöver en destination.'); return; }
    setErr('');

    const from = parsePlace(mFrom);
    const to = parsePlace(mTo);
    const { data: u } = await supabase.auth.getUser();

    const { error } = await supabase.from('stock_movements').insert({
      item_id: mItem, kind: mKind, qty,
      location_type: from.t, location_id: from.i,
      to_location_type: NEEDS_TO.includes(mKind) ? to.t : null,
      to_location_id: NEEDS_TO.includes(mKind) ? to.i : null,
      borrower: NEEDS_BORROWER.includes(mKind) ? mWho.trim() : '',
      note: mNote.trim(),
      moved_by: u?.user?.id ?? null
    });
    if (error) { setErr(error.message); return; }
    setMQty(''); setMNote(''); setMWho(''); load();
  };

  const visible = useMemo(
    () => totals.filter((t) =>
      (!onlyLow || t.under_grans) &&
      (q === '' || t.name.toLowerCase().includes(q.toLowerCase()))
    ),
    [totals, q, onlyLow]
  );

  const lowCount = totals.filter((t) => t.under_grans).length;
  const itemName = (id: string) => totals.find((t) => t.item_id === id)?.name ?? '—';
  const fmt = (d: string) =>
    new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="page-sub">Laddar…</div>;

  return (
    <>
      <h1 className="page-title">Lager</h1>
      <div className="page-sub">
        {totals.length} artiklar
        {lowCount > 0 && ` · ${lowCount} under gränsen`}
        {!canWrite && ' · du har läsbehörighet'}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      {canWrite && (
        <>
          <div className="inline-form cols">
            <div style={{ flex: 2 }}>
              <label className="label">Ny artikel</label>
              <input className="input" value={nName} onChange={(e) => setNName(e.target.value)}
                placeholder="Madrass" onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="select" value={nCat} onChange={(e) => setNCat(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Enhet</label>
              <input className="input" value={nUnit} onChange={(e) => setNUnit(e.target.value)} />
            </div>
            <div>
              <label className="label">Larmgräns</label>
              <input className="input" inputMode="numeric" value={nMin}
                onChange={(e) => setNMin(e.target.value.replace(/\D/g, ''))} />
            </div>
            <button className="btn btn-primary" onClick={addItem} disabled={!nName.trim()}>
              <Plus size={15} /> Lägg till
            </button>
          </div>

          <div className="inline-form cols">
            <div style={{ flex: 2 }}>
              <label className="label">Registrera rörelse</label>
              <select className="select" value={mItem} onChange={(e) => setMItem(e.target.value)}>
                <option value="">Välj artikel…</option>
                {totals.map((t) => <option key={t.item_id} value={t.item_id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Typ</label>
              <select className="select" value={mKind} onChange={(e) => setMKind(e.target.value)}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Antal</label>
              <input className="input" inputMode="numeric" value={mQty}
                onChange={(e) => setMQty(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="label">{NEEDS_TO.includes(mKind) ? 'Från' : 'Plats'}</label>
              <select className="select" value={mFrom} onChange={(e) => setMFrom(e.target.value)}>
                <option value="">Centrallager</option>
                {places.map((p) => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name}</option>)}
              </select>
            </div>
            {NEEDS_TO.includes(mKind) && (
              <div>
                <label className="label">Till</label>
                <select className="select" value={mTo} onChange={(e) => setMTo(e.target.value)}>
                  <option value="">Centrallager</option>
                  {places.map((p) => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name}</option>)}
                </select>
              </div>
            )}
            {NEEDS_BORROWER.includes(mKind) && (
              <div>
                <label className="label">Låntagare</label>
                <input className="input" value={mWho} onChange={(e) => setMWho(e.target.value)} />
              </div>
            )}
            <div style={{ flex: 2 }}>
              <label className="label">Notering</label>
              <input className="input" value={mNote} onChange={(e) => setMNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={addMove}>
              <ArrowRightLeft size={15} /> Registrera
            </button>
          </div>

          {mKind === 'inventering' && (
            <div className="page-sub" style={{ marginTop: -4, marginBottom: 10 }}>
              En inventering <b>sätter</b> saldot på platsen till antalet du anger. Rörelser
              före den räknas inte med längre.
            </div>
          )}
        </>
      )}

      <input className="input" style={{ marginBottom: 10 }} placeholder="Sök artikel"
        value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="chips">
        <button className={`chip ${!onlyLow ? 'active' : ''}`} onClick={() => setOnlyLow(false)}>Alla</button>
        <button className={`chip ${onlyLow ? 'active' : ''}`} onClick={() => setOnlyLow(true)}>
          <AlertTriangle size={13} /> Under gränsen {lowCount > 0 ? `(${lowCount})` : ''}
        </button>
      </div>

      <div className="grid-cards">
        {visible.map((t) => {
          const perPlace = balances.filter((b) => b.item_id === t.item_id && b.qty !== 0);
          return (
            <div key={t.item_id} className="card">
              <div className="li-head">
                <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Package size={16} /> {t.name}
                </div>
                {t.under_grans && <span className="badge b-critical">under gränsen</span>}
              </div>
              <div className="li-meta">{t.category} · larm under {t.min_level} {t.unit}</div>

              <div className="stat-row" style={{ marginTop: 8 }}>
                <span>Totalt</span><b>{t.total} {t.unit}</b>
              </div>

              {perPlace.map((b) => (
                <div key={`${b.location_type}:${b.location_id}`} className="stat-row">
                  <span>{b.location_name}</span><b>{b.qty}</b>
                </div>
              ))}

              <div className="li-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setOpen(open === t.item_id ? null : t.item_id)}>
                  <History size={13} /> Rörelser
                </button>
                <span className="li-meta mono" style={{ marginTop: 0 }}>{t.qr_code}</span>
              </div>

              {open === t.item_id && (
                <div className="list" style={{ marginTop: 8 }}>
                  {moves.filter((m) => m.item_id === t.item_id).slice(0, 12).map((m) => (
                    <div key={m.id} className="list-item" style={{ padding: '7px 0' }}>
                      <div className="li-meta" style={{ marginTop: 0 }}>
                        {fmt(m.moved_at)} · {KIND_LABEL[m.kind] ?? m.kind} · {m.qty}
                        {m.borrower ? ` · ${m.borrower}` : ''}
                        {m.note ? ` · ${m.note}` : ''}
                      </div>
                    </div>
                  ))}
                  {moves.filter((m) => m.item_id === t.item_id).length === 0 && (
                    <div className="page-sub">Inga rörelser än.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <div className="page-sub">Inget här.</div>}
      </div>
    </>
  );
}
