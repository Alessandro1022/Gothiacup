'use client';
// Jourschema, nödnummer och säkerhet per område.
//
// Alla ser schemat och numren – att gömma vem som har jouren bakom en
// behörighet vore att missa poängen. Bara ledningen (tier 4+) lägger upp
// pass och nummer, samma gräns som databasen har.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, Plus, Trash2, ShieldAlert, Siren, ArrowUp, ArrowDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Shift = {
  id: string; function: string; user_id: string | null; contact_name: string; phone: string;
  starts_at: string; ends_at: string; note: string;
};
type Now = { function: string; contact_name: string | null; phone: string | null; ends_at: string };
type Person = { id: string; full_name: string; phone: string | null };
type Emergency = { id: string; label: string; phone: string; kind: string; note: string; sort_order: number };
type Coverage = { area_id: string; area_name: string; on_duty_now: number; assigned_total: number; on_duty_names: string };

export const FUNCTIONS = ['ledning', 'sakerhet', 'boende', 'planer', 'transport', 'maltider', 'sjukvard'] as const;
export const FUNC_LABEL: Record<string, string> = {
  ledning: 'Ledning', sakerhet: 'Säkerhet', boende: 'Boende', planer: 'Planer',
  transport: 'Transport', maltider: 'Måltider', sjukvard: 'Sjukvård'
};
const KIND_LABEL: Record<string, string> = {
  nod: 'Nödnummer', vard: 'Vård', polis: 'Polis', intern: 'Internt', ovrigt: 'Övrigt'
};

// datetime-local vill ha lokal tid utan tidszon
const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export default function OnCallTab({ isManager }: { isManager: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [now, setNow] = useState<Now[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [numbers, setNumbers] = useState<Emergency[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // Nytt jourpass
  const start = new Date(); start.setMinutes(0, 0, 0);
  const [fFunc, setFFunc] = useState<string>('sakerhet');
  const [fUser, setFUser] = useState('');
  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fFrom, setFFrom] = useState(localInput(start));
  const [fTo, setFTo] = useState(localInput(new Date(start.getTime() + 12 * 3600e3)));
  const [fNote, setFNote] = useState('');

  // Formulären är ihopfällda så att schemat syns först på telefonen
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showNumberForm, setShowNumberForm] = useState(false);

  // Nytt nödnummer
  const [nLabel, setNLabel] = useState('');
  const [nPhone, setNPhone] = useState('');
  const [nKind, setNKind] = useState('intern');

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const [s, n, p, e, c] = await Promise.all([
      supabase.from('on_call_shifts').select('*').gte('ends_at', since).order('starts_at').limit(300),
      supabase.from('on_call_now').select('function,contact_name,phone,ends_at'),
      supabase.from('profiles').select('id,full_name,phone').order('full_name'),
      supabase.from('emergency_contacts').select('*').order('sort_order'),
      isManager ? supabase.from('security_coverage').select('*').order('area_name')
                : Promise.resolve({ data: [], error: null })
    ]);
    if (s.error) setErr(`Jourschemat gick inte att läsa: ${s.error.message}`);
    setShifts((s.data ?? []) as Shift[]);
    setNow((n.data ?? []) as Now[]);
    setPeople((p.data ?? []) as Person[]);
    setNumbers((e.data ?? []) as Emergency[]);
    setCoverage((c.data ?? []) as Coverage[]);
    setLoading(false);
  }, [supabase, isManager]);

  useEffect(() => {
    load();
    const ch = supabase.channel('oncall-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'on_call_shifts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, supabase]);

  const person = people.find((p) => p.id === fUser);

  const addShift = async () => {
    setErr(''); setOk('');
    const from = new Date(fFrom), to = new Date(fTo);
    if (!(to > from)) { setErr('Passet måste sluta efter att det börjar.'); return; }
    if (!fUser && !fName.trim()) { setErr('Välj en person eller skriv ett namn.'); return; }
    const phone = fPhone.trim() || person?.phone || '';
    if (!phone) { setErr('Ange ett telefonnummer – jouren ska gå att ringa.'); return; }
    const { error } = await supabase.from('on_call_shifts').insert({
      function: fFunc, user_id: fUser || null,
      contact_name: fUser ? '' : fName.trim(),
      phone: fPhone.trim(),
      starts_at: from.toISOString(), ends_at: to.toISOString(), note: fNote.trim()
    });
    if (error) { setErr(error.message); return; }
    setFNote(''); setFName(''); setFPhone('');
    setShowShiftForm(false);
    setOk('Jourpasset är upplagt.');
    load();
  };

  const removeShift = async (s: Shift) => {
    if (!confirm('Ta bort jourpasset?')) return;
    const { error } = await supabase.from('on_call_shifts').delete().eq('id', s.id);
    if (error) setErr(error.message);
    load();
  };

  const addNumber = async () => {
    setErr(''); setOk('');
    if (!nLabel.trim() || !nPhone.trim()) return;
    const sort = (numbers[numbers.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from('emergency_contacts').insert({
      label: nLabel.trim(), phone: nPhone.trim(), kind: nKind, sort_order: sort
    });
    if (error) { setErr(error.message); return; }
    setNLabel(''); setNPhone('');
    setShowNumberForm(false);
    load();
  };

  const removeNumber = async (e: Emergency) => {
    if (!confirm(`Ta bort ${e.label}?`)) return;
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', e.id);
    if (error) setErr(error.message);
    load();
  };

  // Byt plats med grannen genom att byta sorteringsvärden
  const moveNumber = async (i: number, dir: -1 | 1) => {
    const a = numbers[i], b = numbers[i + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('emergency_contacts').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('emergency_contacts').update({ sort_order: a.sort_order }).eq('id', b.id)
    ]);
    load();
  };

  const nameOf = (s: Shift) =>
    s.contact_name || people.find((p) => p.id === s.user_id)?.full_name || '—';
  const phoneOf = (s: Shift) =>
    s.phone || people.find((p) => p.id === s.user_id)?.phone || '';
  const hm = (d: string) => new Date(d).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const day = (d: string) => new Date(d).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  // Schemat grupperat per dag
  const byDay = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const k = new Date(s.starts_at).toDateString();
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.values()];
  }, [shifts]);

  if (loading) return <div className="page-sub">Laddar jouren…</div>;

  const t = Date.now();

  return (
    <>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
      {ok && <div className="ok-msg" style={{ marginBottom: 10 }}>{ok}</div>}

      <h2 style={{ marginBottom: 8 }}>Jour just nu</h2>
      <div className="list" style={{ marginBottom: 18 }}>
        {FUNCTIONS.map((f) => {
          const n = now.find((x) => x.function === f);
          if (!n && !isManager) return null;
          return (
            <div key={f} className="list-item oncall-row">
              <div style={{ minWidth: 0 }}>
                <div className="li-title">{FUNC_LABEL[f]}</div>
                <div className="li-meta" style={{ marginTop: 2 }}>
                  {n ? `${n.contact_name || 'Namn saknas'} · till ${hm(n.ends_at)}` : 'Ingen jour schemalagd'}
                </div>
              </div>
              {n?.phone
                ? <a className="btn btn-sm btn-primary" href={tel(n.phone)}><Phone size={14} /> {n.phone}</a>
                : <span className="badge b-critical">saknas</span>}
            </div>
          );
        })}
        {!isManager && now.length === 0 && (
          <div className="page-sub">Ingen jour är schemalagd just nu.</div>
        )}
      </div>

      {isManager && !showShiftForm && (
        <button className="btn btn-primary" style={{ marginBottom: 18 }} onClick={() => { setShowShiftForm(true); setOk(''); }}>
          <Plus size={15} /> Lägg upp jourpass
        </button>
      )}
      {isManager && showShiftForm && (
        <>
          <h2 style={{ marginBottom: 8 }}>Lägg upp jourpass</h2>
          <div className="inline-form cols">
            <div>
              <label className="label">Funktion</label>
              <select className="select" value={fFunc} onChange={(e) => setFFunc(e.target.value)}>
                {FUNCTIONS.map((f) => <option key={f} value={f}>{FUNC_LABEL[f]}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label className="label">Person</label>
              <select className="select" value={fUser} onChange={(e) => setFUser(e.target.value)}>
                <option value="">Annan, utan konto</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || '—'}</option>)}
              </select>
            </div>
            {!fUser && (
              <div>
                <label className="label">Namn</label>
                <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="t.ex. inhyrd vakt" />
              </div>
            )}
            <div>
              <label className="label">Telefon</label>
              <input className="input" type="tel" value={fPhone} onChange={(e) => setFPhone(e.target.value)}
                placeholder={person?.phone || '070-…'} />
            </div>
            <div>
              <label className="label">Från</label>
              <input className="input" type="datetime-local" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Till</label>
              <input className="input" type="datetime-local" value={fTo} onChange={(e) => setFTo(e.target.value)} />
            </div>
            <div style={{ flex: 2 }}>
              <label className="label">Anteckning</label>
              <input className="input" value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="t.ex. nås via radio kanal 3" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary" onClick={addShift}><Plus size={15} /> Lägg upp</button>
              <button className="btn" onClick={() => setShowShiftForm(false)}>Avbryt</button>
            </div>
          </div>
          {fUser && !person?.phone && !fPhone && (
            <div className="li-meta" style={{ marginTop: -8, marginBottom: 12 }}>
              Personen saknar telefonnummer i sin profil – skriv numret ovan.
            </div>
          )}
        </>
      )}

      <h2 style={{ marginBottom: 8 }}>Jourschema</h2>
      {byDay.map((list) => (
        <div key={list[0].id} style={{ marginBottom: 14 }}>
          <div className="li-meta" style={{ fontWeight: 700, textTransform: 'capitalize', marginBottom: 6 }}>
            {day(list[0].starts_at)}
          </div>
          <div className="list">
            {list.map((s) => {
              const active = new Date(s.starts_at).getTime() <= t && new Date(s.ends_at).getTime() >= t;
              const past = new Date(s.ends_at).getTime() < t;
              return (
                <div key={s.id} className="list-item oncall-row" style={past ? { opacity: 0.55 } : undefined}>
                  <div style={{ minWidth: 0 }}>
                    <div className="li-title">
                      {FUNC_LABEL[s.function] ?? s.function} · {nameOf(s)}
                      {active && <span className="badge b-ongoing" style={{ marginLeft: 6 }}>nu</span>}
                    </div>
                    <div className="li-meta mono" style={{ marginTop: 2 }}>
                      {hm(s.starts_at)}–{hm(s.ends_at)}{phoneOf(s) ? ` · ${phoneOf(s)}` : ''}
                      {s.note ? ` · ${s.note}` : ''}
                    </div>
                  </div>
                  {isManager && (
                    <button className="move-btn" onClick={() => removeShift(s)} aria-label="Ta bort jourpass">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {shifts.length === 0 && <div className="page-sub">Inga jourpass upplagda.</div>}

      <h2 style={{ margin: '18px 0 8px' }}>Nödnummer</h2>
      <div className="list" style={{ marginBottom: 12 }}>
        {numbers.map((e, i) => (
          <div key={e.id} className="list-item oncall-row">
            <div style={{ minWidth: 0 }}>
              <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {e.kind === 'nod' && <Siren size={14} style={{ color: 'var(--danger)' }} />} {e.label}
              </div>
              <div className="li-meta" style={{ marginTop: 2 }}>{KIND_LABEL[e.kind] ?? e.kind}{e.note ? ` · ${e.note}` : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <a className="btn btn-sm" href={tel(e.phone)}><Phone size={14} /> {e.phone}</a>
              {isManager && (
                <>
                  <button className="move-btn" disabled={i === 0} onClick={() => moveNumber(i, -1)} aria-label="Flytta upp"><ArrowUp size={14} /></button>
                  <button className="move-btn" disabled={i === numbers.length - 1} onClick={() => moveNumber(i, 1)} aria-label="Flytta ner"><ArrowDown size={14} /></button>
                  <button className="move-btn" onClick={() => removeNumber(e)} aria-label="Ta bort"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {isManager && !showNumberForm && (
        <button className="btn btn-sm" onClick={() => setShowNumberForm(true)}>
          <Plus size={14} /> Nytt nödnummer
        </button>
      )}
      {isManager && showNumberForm && (
        <div className="inline-form cols">
          <div style={{ flex: 2 }}>
            <label className="label">Benämning</label>
            <input className="input" value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="t.ex. Sjukvårdstältet Heden" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input className="input" type="tel" value={nPhone} onChange={(e) => setNPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Typ</label>
            <select className="select" value={nKind} onChange={(e) => setNKind(e.target.value)}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" onClick={addNumber} disabled={!nLabel.trim() || !nPhone.trim()}>
              <Plus size={15} /> Lägg till
            </button>
            <button className="btn" onClick={() => setShowNumberForm(false)}>Avbryt</button>
          </div>
        </div>
      )}

      {isManager && coverage.length > 0 && (
        <>
          <h2 style={{ margin: '18px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={14} /> Säkerhet per område just nu
          </h2>
          <div className="list">
            {coverage.map((c) => (
              <div key={c.area_id} className="list-item oncall-row">
                <div style={{ minWidth: 0 }}>
                  <div className="li-title">{c.area_name}</div>
                  <div className="li-meta" style={{ marginTop: 2 }}>
                    {c.on_duty_names || 'Ingen i tjänst'} · {c.assigned_total} knutna till området
                  </div>
                </div>
                <span className={`badge ${c.on_duty_now > 0 ? 'b-resolved' : 'b-critical'}`}>
                  {c.on_duty_now} i tjänst
                </span>
              </div>
            ))}
          </div>
          <div className="li-meta" style={{ marginTop: 8 }}>
            Räknas fram ur säkerhetsroller, områdeskoppling och pass. Ingen separat
            lista att hålla uppdaterad.
          </div>
        </>
      )}
    </>
  );
}
