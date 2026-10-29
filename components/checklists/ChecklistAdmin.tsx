'use client';
// Ledningens vy över checklistor: vad som skulle gjorts idag och vad som
// gjorts, samt mallarna. En daglig mall gäller varje plats av sin typ.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ClipboardCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';

type Template = {
  id: string; name: string; location_type: 'school' | 'arena'; items: string[];
  cadence?: string; due_time?: string | null; active?: boolean;
};
type Due = {
  template_id: string; template_name: string; cadence: string; due_time: string | null;
  location_type: 'school' | 'arena'; location_id: string; location_name: string;
  run_id: string | null; run_status?: string | null;
};

export const CADENCE_LABEL: Record<string, string> = {
  daglig: 'Varje dag', varje_pass: 'Varje pass', veckovis: 'Varje vecka', engang: 'En gång'
};

export default function ChecklistAdmin() {
  const tn = useTenant();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'idag' | 'mallar'>('idag');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [due, setDue] = useState<Due[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // Mallformulär
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState<'school' | 'arena'>('school');
  const [fCadence, setFCadence] = useState('daglig');
  const [fTime, setFTime] = useState('');
  const [fItems, setFItems] = useState('');
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([
      supabase.from('checklist_templates').select('*').order('name'),
      supabase.from('checklist_due_today').select('*')
    ]);
    if (t.error) setErr(t.error.message);
    setTemplates((t.data ?? []) as Template[]);
    setDue((d.data ?? []) as Due[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Per mall: hur många platser som är klara, påbörjade och ogjorda
  const byTemplate = useMemo(() => {
    const m = new Map<string, Due[]>();
    for (const d of due) m.set(d.template_id, [...(m.get(d.template_id) ?? []), d]);
    return [...m.values()].map((rows) => ({
      first: rows[0],
      done: rows.filter((r) => r.run_status === 'done'),
      started: rows.filter((r) => r.run_id && r.run_status !== 'done'),
      missing: rows.filter((r) => !r.run_id).sort((a, b) => a.location_name.localeCompare(b.location_name, 'sv')),
      total: rows.length
    }));
  }, [due]);

  const reset = () => {
    setShowForm(false); setEditId(null); setFName(''); setFType('school'); setFCadence('daglig');
    setFTime(''); setFItems(''); setFActive(true);
  };

  const edit = (t: Template) => {
    setShowForm(true); setEditId(t.id); setFName(t.name); setFType(t.location_type);
    setFCadence(t.cadence ?? 'engang'); setFTime((t.due_time ?? '').slice(0, 5));
    setFItems((t.items ?? []).join('\n')); setFActive(t.active !== false);
  };

  const save = async () => {
    setErr('');
    const items = fItems.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!fName.trim() || items.length === 0) { setErr('Ge mallen ett namn och minst en punkt.'); return; }
    const payload = {
      name: fName.trim(), location_type: fType, items,
      cadence: fCadence, due_time: fTime || null, active: fActive
    };
    const { error } = editId
      ? await supabase.from('checklist_templates').update(payload).eq('id', editId)
      : await supabase.from('checklist_templates').insert(payload);
    if (error) { setErr(error.message); return; }
    reset(); load();
  };

  const remove = async (t: Template) => {
    if (!confirm(`Ta bort mallen "${t.name}"? Gjorda körningar finns kvar.`)) return;
    const { error } = await supabase.from('checklist_templates').delete().eq('id', t.id);
    if (error) setErr(error.message);
    load();
  };

  const placeHref = (d: Due) => (d.location_type === 'school' ? `/schools/${d.location_id}` : `/arenas/${d.location_id}`);
  const typeLabel = (t: 'school' | 'arena') => (t === 'school' ? tn.labels.schools : tn.labels.playingAreas);

  if (loading) return <div className="page-sub">Laddar checklistor…</div>;

  return (
    <>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
      <div className="chips">
        <button className={`chip ${view === 'idag' ? 'active' : ''}`} onClick={() => setView('idag')}>Idag</button>
        <button className={`chip ${view === 'mallar' ? 'active' : ''}`} onClick={() => setView('mallar')}>
          Mallar <span className="mono" style={{ marginLeft: 6, opacity: 0.7 }}>{templates.length}</span>
        </button>
      </div>

      {view === 'idag' && (
        <>
          {byTemplate.map((g) => {
            const pct = g.total ? Math.round((g.done.length / g.total) * 100) : 0;
            const isOpen = open === g.first.template_id;
            return (
              <div key={g.first.template_id} className="card" style={{ marginBottom: 10 }}>
                <div className="li-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="li-title">{g.first.template_name}</div>
                    <div className="li-meta">
                      {typeLabel(g.first.location_type)} · {CADENCE_LABEL[g.first.cadence] ?? g.first.cadence}
                      {g.first.due_time ? ` · senast ${g.first.due_time.slice(0, 5)}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${g.done.length === g.total ? 'b-resolved' : 'b-medium'}`}>
                    {g.done.length}/{g.total}
                  </span>
                </div>
                <div className="prog" style={{ margin: '10px 0 6px' }}><div style={{ width: `${pct}%` }} /></div>
                <div className="li-meta" style={{ marginTop: 0 }}>
                  {g.done.length} klara · {g.started.length} påbörjade · {g.missing.length} inte gjorda
                </div>
                {(g.missing.length > 0 || g.started.length > 0) && (
                  <button className="btn btn-sm btn-ghost" style={{ marginTop: 6, paddingLeft: 0 }}
                    onClick={() => setOpen(isOpen ? null : g.first.template_id)}>
                    {isOpen ? 'Dölj platserna' : 'Visa platserna som återstår'}
                  </button>
                )}
                {isOpen && (
                  <div className="ref-schedule">
                    {[...g.started, ...g.missing].map((d) => (
                      <Link key={d.location_id} href={placeHref(d)} className="ref-match">
                        <span>{d.location_name}</span>
                        <b style={{ color: d.run_id ? '#8A6A12' : 'var(--danger)', fontSize: 11, textTransform: 'uppercase' }}>
                          {d.run_id ? 'påbörjad' : 'inte gjord'}
                        </b>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {byTemplate.length === 0 && (
            <div className="page-sub">
              Inga dagliga checklistor. Lägg upp en mall med intervallet Varje dag, så syns här vilka platser som gjort den.
            </div>
          )}
        </>
      )}

      {view === 'mallar' && (
        <>
          {!showForm && (
            <button className="btn btn-primary" style={{ marginBottom: 14 }} onClick={() => setShowForm(true)}>
              <Plus size={15} /> Ny mall
            </button>
          )}
          {showForm && (
            <div className="inline-form">
              <div><label className="label">Namn</label>
                <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="t.ex. Kvällsrond boende" /></div>
              <div><label className="label">Gäller</label>
                <select className="select" value={fType} onChange={(e) => setFType(e.target.value as 'school' | 'arena')}>
                  <option value="school">{tn.labels.schools}</option>
                  <option value="arena">{tn.labels.playingAreas}</option>
                </select></div>
              <div><label className="label">Intervall</label>
                <select className="select" value={fCadence} onChange={(e) => setFCadence(e.target.value)}>
                  {Object.entries(CADENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="label">Klar senast</label>
                <input className="input" type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} /></div>
              <div><label className="label">Punkter, en per rad</label>
                <textarea className="textarea" value={fItems} onChange={(e) => setFItems(e.target.value)}
                  placeholder={'Nödutgångar fria\nBrandsläckare på plats\nDuschar fungerar'} /></div>
              <label className="check-row">
                <input type="checkbox" checked={fActive} onChange={() => setFActive(!fActive)} /> Aktiv
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={save}>{editId ? 'Spara' : 'Lägg till mall'}</button>
                <button className="btn" onClick={reset}>Avbryt</button>
              </div>
            </div>
          )}
          <div className="list">
            {templates.map((t) => (
              <div key={t.id} className="list-item" style={t.active === false ? { opacity: 0.6 } : undefined}>
                <div className="li-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ClipboardCheck size={15} /> {t.name}
                    </div>
                    <div className="li-meta">
                      {typeLabel(t.location_type)} · {CADENCE_LABEL[t.cadence ?? 'engang'] ?? t.cadence}
                      {t.due_time ? ` · senast ${t.due_time.slice(0, 5)}` : ''} · {(t.items ?? []).length} punkter
                      {t.active === false ? ' · inaktiv' : ''}
                    </div>
                  </div>
                </div>
                <div className="li-actions">
                  <button className="btn btn-sm" onClick={() => edit(t)}><Pencil size={13} /> Ändra</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(t)} aria-label="Ta bort"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <div className="page-sub">Inga mallar än.</div>}
          </div>
        </>
      )}
    </>
  );
}
