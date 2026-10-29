'use client';
// Plattformsvy för ägaren: skapa turneringar, färgsätt dem, växla sin egen
// vy mellan dem och bjuda in en chef till varje.
//
// Obs skillnaden mot tidigare: "Aktivera" fanns när bara en turnering kunde
// vara igång. Nu pågår flera samtidigt, så knappen växlar BARA din egen vy
// genom att ändra din tenant_id. Andra användare påverkas inte.
// "Pågår" är enbart en status på turneringen.
import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, Trash2, LogIn, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';
import {
  FEATURE_KEYS, FEATURE_LABELS, labelsForSport, countModules,
  type FeatureKey, type TenantRow, type PlanRow
} from '@/lib/features';

const SPORTS = ['fotboll', 'innebandy', 'handboll', 'basket', 'dans', 'annat'];

const PRESETS: { name: string; colors: Record<string, string> }[] = [
  { name: 'Turneringsblå', colors: { primary: '#1D6FA8', primaryDark: '#155A8C', panel2: '#25618F', accent: '#FFC845', bg: '#F2F5F9' } },
  { name: 'Skogsgrön',     colors: { primary: '#1E9E5A', primaryDark: '#177C46', panel2: '#1E6B45', accent: '#FFD24C', bg: '#F3F7F4' } },
  { name: 'Djupröd',       colors: { primary: '#C0392B', primaryDark: '#9C2D21', panel2: '#8E2A20', accent: '#F4B23C', bg: '#FAF4F3' } },
  { name: 'Midnatt',       colors: { primary: '#4C6FE0', primaryDark: '#3A57BC', panel2: '#232B47', accent: '#FFC845', bg: '#F4F5FA' } },
  { name: 'Lila',          colors: { primary: '#7C4DBE', primaryDark: '#643C9C', panel2: '#4B2E75', accent: '#FFC845', bg: '#F7F4FB' } }
];

type Draft = {
  slug: string; name: string; short_name: string; sport: string; city: string;
  logo_text: string; logo_url: string;
  colors: Record<string, string>;
  labels: Record<string, string>;
  features: Record<string, boolean>;
  plan_id: string | null;
  plan_name: string;
  price_per_year: string;      // textfält, tomt = offert
  plan_customized: boolean;
  billing_note: string;
};

const emptyDraft = (): Draft => ({
  slug: '', name: '', short_name: '', sport: 'fotboll', city: '',
  logo_text: '', logo_url: '',
  colors: { ...PRESETS[0].colors },
  labels: { ...labelsForSport('fotboll'), school: 'Skola', schools: 'Skolor', area: 'Område', areas: 'Områden' },
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])),
  plan_id: null, plan_name: '', price_per_year: '', plan_customized: false, billing_note: ''
});

export default function PlatformClient() {
  const supabase = createClient();
  const tn = useTenant();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [open, setOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState<TenantRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      supabase.from('tenants').select('*').order('name'),
      supabase.from('plans').select('*').eq('active', true).order('sort_order')
    ]);
    if (t.error) setErr(t.error.message);
    setRows((t.data ?? []) as TenantRow[]);
    // Saknas plans-tabellen ännu visas bara modulreglagen, inga paket
    setPlans((p.data ?? []) as PlanRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const slugify = (s: string) =>
    s.toLowerCase().trim()
      .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const startNew = () => {
    setEditId(null); setDraft(emptyDraft()); setErr(''); setMsg(''); setOpen(true);
  };

  const startEdit = (t: TenantRow) => {
    setEditId(t.id);
    setDraft({
      slug: t.slug, name: t.name, short_name: t.short_name, sport: t.sport, city: t.city,
      logo_text: t.logo_text, logo_url: t.logo_url ?? '',
      colors: { ...PRESETS[0].colors, ...(t.colors ?? {}) } as Record<string, string>,
      labels: {
        ...labelsForSport(t.sport),
        school: 'Skola', schools: 'Skolor', area: 'Område', areas: 'Områden',
        ...(t.labels ?? {})
      } as Record<string, string>,
      features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, t.features?.[k] !== false])),
      plan_id: t.plan_id ?? null,
      plan_name: t.plan_name ?? '',
      price_per_year: t.price_per_year === null || t.price_per_year === undefined ? '' : String(t.price_per_year),
      plan_customized: !!t.plan_customized,
      billing_note: t.billing_note ?? ''
    });
    setErr(''); setMsg(''); setOpen(true);
  };

  const duplicate = (t: TenantRow) => {
    startEdit(t);
    setEditId(null);
    setDraft((d) => ({ ...d, name: `${t.name} (kopia)`, slug: `${t.slug}-kopia` }));
  };

  const save = async () => {
    setErr(''); setMsg('');
    const name = draft.name.trim();
    if (!name) { setErr('Namn krävs'); return; }
    const payload = {
      slug: draft.slug.trim() || slugify(name),
      name,
      short_name: draft.short_name.trim() || name.split(' ')[0],
      sport: draft.sport,
      city: draft.city.trim(),
      logo_text: (draft.logo_text.trim() || name.slice(0, 2)).toUpperCase(),
      logo_url: draft.logo_url.trim() || null,
      colors: draft.colors,
      labels: draft.labels,
      features: draft.features,
      plan_id: draft.plan_id,
      plan_name: draft.plan_name,
      price_per_year: draft.price_per_year.trim() === '' ? null : Number(draft.price_per_year),
      plan_customized: draft.plan_customized,
      billing_note: draft.billing_note.trim()
    };
    const { error } = editId
      ? await supabase.from('tenants').update(payload).eq('id', editId)
      : await supabase.from('tenants').insert(payload);
    if (error) { setErr(error.message); return; }
    setOpen(false); setMsg('Sparat'); load(); tn.reload();
  };

  // Växlar BARA din egen vy. Hela appen laddas om eftersom all data byts.
  const switchTo = async (t: TenantRow) => {
    setErr(''); setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) { setErr('Ej inloggad'); setBusy(false); return; }
    const { error } = await supabase.from('profiles')
      .update({ tenant_id: t.id }).eq('id', u.user.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    window.location.reload();
  };

  const toggleRunning = async (t: TenantRow) => {
    setErr('');
    const { error } = await supabase.from('tenants')
      .update({ active: !t.active }).eq('id', t.id);
    if (error) setErr(error.message); else load();
  };

  const sendInvite = async () => {
    if (!inviteFor) return;
    setErr(''); setMsg(''); setBusy(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: 'leadership',
          tenantId: inviteFor.id
        })
      });
      const body = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) { setErr(body.error || 'Inbjudan misslyckades'); return; }
      setMsg(`Inbjudan skickad till ${inviteEmail.trim()} för ${inviteFor.name}`);
      setInviteFor(null); setInviteEmail('');
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : 'Inbjudan misslyckades');
    }
  };

  const remove = async (t: TenantRow) => {
    if (t.id === tn.active?.id) { setErr('Växla till en annan turnering innan du raderar den här.'); return; }
    if (!confirm(`Radera ${t.name}? All data i turneringen raderas och det går inte att ångra.`)) return;
    const { error } = await supabase.from('tenants').delete().eq('id', t.id);
    if (error) setErr(error.message);
    load();
  };

  const setColor = (k: string, v: string) =>
    setDraft((d) => ({ ...d, colors: { ...d.colors, [k]: v } }));
  // Paketets moduler KOPIERAS in. De läses inte live, så att en senare
  // ändring av paketet inte tyst tar bort moduler hos befintliga kunder.
  const applyPlan = (pl: PlanRow) =>
    setDraft((d) => ({
      ...d,
      plan_id: pl.id,
      plan_name: pl.name,
      price_per_year: pl.price_per_year === null ? '' : String(pl.price_per_year),
      features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, pl.features?.[k] !== false])),
      plan_customized: false
    }));

  // Rör man ett enskilt reglage är paketet inte längre standard
  const toggleFeature = (k: FeatureKey) =>
    setDraft((d) => ({
      ...d,
      features: { ...d.features, [k]: !d.features[k] },
      plan_customized: d.plan_id ? true : d.plan_customized
    }));
  const applyPreset = (p: typeof PRESETS[number]) =>
    setDraft((d) => ({ ...d, colors: { ...p.colors } }));
  const applySport = (s: string) =>
    setDraft((d) => ({ ...d, sport: s, labels: { ...d.labels, ...labelsForSport(s) } }));

  const activeCount = FEATURE_KEYS.filter((k) => draft.features[k]).length;

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title">Plattform</h1>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {rows.length} turneringar · du är i {tn.name}
          </div>
        </div>
        <button className="btn btn-primary" onClick={startNew}>
          <Plus size={16} /> Ny turnering
        </button>
      </div>

      {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}
      {msg && <div className="ok-msg" style={{ marginBottom: 12 }}>{msg}</div>}
      {loading && <div className="page-sub">Laddar…</div>}

      <div className="grid-cards" style={{ marginTop: 14 }}>
        {rows.map((t) => {
          const here = t.id === tn.active?.id;
          return (
            <div key={t.id} className="card">
              <div className="li-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                    background: t.colors?.panel2 ?? '#25618F', color: '#fff',
                    display: 'grid', placeItems: 'center', fontWeight: 800
                  }}>
                    {t.logo_text || t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="li-title">{t.name}</div>
                    <div className="li-meta" style={{ marginTop: 2 }}>
                      {t.sport}{t.city ? ` · ${t.city}` : ''}
                    </div>
                  </div>
                </div>
                {here && <span className="badge b-resolved">Din vy</span>}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '14px 0 10px' }}>
                {['primary', 'panel2', 'accent'].map((k) => (
                  <div key={k} style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: (t.colors as Record<string, string>)?.[k] ?? '#ccc',
                    border: '1px solid rgba(0,0,0,.08)'
                  }} />
                ))}
                <div className="li-meta" style={{ marginTop: 0, marginLeft: 6 }}>
                  {countModules(t.features)} av {FEATURE_KEYS.length} moduler
                </div>
              </div>

              {t.plan_name && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  gap: 10, padding: '9px 12px', borderRadius: 10,
                  background: 'var(--bg)', marginBottom: 10
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {t.plan_name}
                    {t.plan_customized && (
                      <span className="li-meta" style={{ marginLeft: 7, marginTop: 0 }}>anpassat</span>
                    )}
                  </span>
                </div>
              )}

              <label className="check-row" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={!!t.active} onChange={() => toggleRunning(t)} />
                Pågår just nu
              </label>

              <div className="li-actions">
                {!here && (
                  <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => switchTo(t)}>
                    <LogIn size={14} /> Växla hit
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => startEdit(t)}>Redigera</button>
                <button className="btn btn-sm" onClick={() => { setInviteFor(t); setInviteEmail(''); setErr(''); setMsg(''); }}>
                  <UserPlus size={13} /> Bjud in chef
                </button>
                <button className="btn btn-sm" onClick={() => duplicate(t)}>
                  <Copy size={13} /> Kopiera
                </button>
                {!here && (
                  <button className="btn btn-sm btn-danger" onClick={() => remove(t)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && rows.length === 0 && (
          <div className="page-sub">Inga turneringar ännu – kör schema_part6_tenants.sql först.</div>
        )}
      </div>

      {inviteFor && (
        <div className="modal-overlay" onClick={() => setInviteFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>Bjud in chef till {inviteFor.name}</h3>
            <div className="page-sub">
              Personen får rollen ledning i den här turneringen och kan sedan bjuda in
              sin egen personal. Hen ser ingen data från dina andra turneringar.
            </div>
            <label className="label">E-post</label>
            <input className="input" type="email" value={inviteEmail} autoComplete="off"
              onChange={(e) => setInviteEmail(e.target.value)} placeholder="chef@exempel.se" />
            <div className="modal-actions">
              <button className="btn" onClick={() => setInviteFor(null)}>Avbryt</button>
              <button className="btn btn-primary" disabled={busy || !/.+@.+\..+/.test(inviteEmail)}
                onClick={sendInvite}>
                Skicka inbjudan
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3>{editId ? 'Redigera turnering' : 'Ny turnering'}</h3>
            <div className="page-sub">Namn, färger och moduler. Växla hit efteråt för att se den.</div>

            <label className="label">Namn</label>
            <input className="input" value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Partille Cup" />

            <div className="inline-form cols" style={{ border: 'none', padding: 0, background: 'none', marginTop: 4 }}>
              <div>
                <label className="label">Kortnamn</label>
                <input className="input" value={draft.short_name}
                  onChange={(e) => setDraft({ ...draft, short_name: e.target.value })} placeholder="Partille" />
              </div>
              <div>
                <label className="label">Ort</label>
                <input className="input" value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Partille" />
              </div>
              <div>
                <label className="label">Bokstäver i brickan</label>
                <input className="input" value={draft.logo_text} maxLength={3}
                  onChange={(e) => setDraft({ ...draft, logo_text: e.target.value })} placeholder="PC" />
              </div>
            </div>

            <label className="label">Sport</label>
            <select className="select" value={draft.sport} onChange={(e) => applySport(e.target.value)}>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="li-meta">
              Ger automatiskt rätt ord: {draft.labels.playingArea} · {draft.labels.playingAreas} · {draft.labels.matchStart}
            </div>

            <label className="label">Logotyp (länk, valfritt)</label>
            <input className="input" value={draft.logo_url}
              onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })}
              placeholder="https://…/logo.png" />

            <label className="label">Färgtema</label>
            <div className="chips" style={{ margin: '0 0 10px' }}>
              {PRESETS.map((p) => (
                <button key={p.name} className="chip" onClick={() => applyPreset(p)}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, marginRight: 7,
                    background: p.colors.primary, display: 'inline-block'
                  }} />
                  {p.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {([
                ['primary', 'Primärfärg'],
                ['panel2', 'Meny och topp'],
                ['accent', 'Accent'],
                ['bg', 'Bakgrund']
              ] as const).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color"
                    value={draft.colors[key] ?? '#1D6FA8'}
                    onChange={(e) => setColor(key, e.target.value)}
                    style={{
                      width: 48, height: 42, border: '1px solid var(--line)',
                      borderRadius: 11, background: '#fff', padding: 3, flexShrink: 0
                    }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                    <div className="li-meta mono" style={{ marginTop: 1 }}>{draft.colors[key]}</div>
                  </div>
                </div>
              ))}
            </div>

            {plans.length > 0 && (
              <>
                <label className="label" style={{ marginTop: 18 }}>Modulpaket</label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {plans.map((pl) => {
                    const picked = draft.plan_id === pl.id;
                    return (
                      <button key={pl.id} onClick={() => applyPlan(pl)}
                        style={{
                          textAlign: 'left', padding: '12px 14px', borderRadius: 11, cursor: 'pointer',
                          border: picked ? '2px solid var(--primary)' : '1px solid var(--line)',
                          background: picked ? 'color-mix(in srgb, var(--primary) 7%, transparent)' : '#fff'
                        }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{pl.name}</span>
                        <div className="li-meta" style={{ marginTop: 3 }}>
                          {countModules(pl.features)} av {FEATURE_KEYS.length} moduler · {pl.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

              </>
            )}

            <label className="label" style={{ marginTop: 18 }}>
              Moduler · {activeCount} av {FEATURE_KEYS.length} på
              {draft.plan_customized && (
                <span className="badge" style={{ marginLeft: 8 }}>anpassat</span>
              )}
            </label>
            <div style={{ display: 'grid', gap: 7 }}>
              {FEATURE_KEYS.map((k) => (
                <label key={k} className={`check-row ${draft.features[k] ? '' : 'done'}`}>
                  <input type="checkbox" checked={!!draft.features[k]} onChange={() => toggleFeature(k)} />
                  {FEATURE_LABELS[k]}
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setOpen(false)}>Avbryt</button>
              <button className="btn btn-primary" onClick={save} disabled={!draft.name.trim()}>Spara</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
