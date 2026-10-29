'use client';
// Digital introduktion. Var och en ser punkterna för sin roll och bockar av
// dem. Ledningen lägger upp punkterna och ser vem som inte är klar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraduationCap, Check, Plus, Trash2, Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ROLE_GROUPS, ROLE_LABELS, type Role } from '@/lib/types';

type Item = {
  id: string; title: string; body: string; roles: Role[]; required: boolean; sort_order: number;
};
type Status = {
  user_id: string; full_name: string; role: Role;
  required_items: number; done_items: number; complete: boolean;
};

// Gäller punkten den här rollen? Tom rollista betyder alla.
export const appliesTo = (it: { roles: string[] | null }, role: string) =>
  !it.roles || it.roles.length === 0 || it.roles.includes(role);

export default function IntroTab({ userId, role, isManager, onChange }: {
  userId: string; role: Role; isManager: boolean; onChange?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<'mina' | 'hantera' | 'status'>('mina');

  // Formulär för ny eller ändrad punkt
  const [editId, setEditId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fRoles, setFRoles] = useState<Role[]>([]);
  const [fRequired, setFRequired] = useState(true);

  const load = useCallback(async () => {
    const [i, d, s] = await Promise.all([
      supabase.from('onboarding_items').select('*').order('sort_order'),
      supabase.from('onboarding_done').select('item_id').eq('user_id', userId),
      isManager ? supabase.from('onboarding_status').select('*').order('full_name')
                : Promise.resolve({ data: [], error: null })
    ]);
    if (i.error) setErr(i.error.message);
    setItems(((i.data ?? []) as Item[]).map((x) => ({ ...x, roles: x.roles ?? [] })));
    setDone(new Set(((d.data ?? []) as { item_id: string }[]).map((x) => x.item_id)));
    setStatus((s.data ?? []) as Status[]);
    setLoading(false);
  }, [supabase, userId, isManager]);

  useEffect(() => { load(); }, [load]);

  const mine = items.filter((it) => appliesTo(it, role));
  const left = mine.filter((it) => it.required && !done.has(it.id)).length;

  const markDone = async (it: Item) => {
    const { error } = await supabase.from('onboarding_done').insert({ item_id: it.id, user_id: userId });
    if (error && !/duplicate/i.test(error.message)) setErr(error.message);
    await load();
    onChange?.();
  };

  const reset = () => {
    setEditId(null); setFTitle(''); setFBody(''); setFRoles([]); setFRequired(true);
  };

  const edit = (it: Item) => {
    setEditId(it.id); setFTitle(it.title); setFBody(it.body);
    setFRoles(it.roles); setFRequired(it.required);
    setView('hantera');
  };

  const save = async () => {
    setErr('');
    if (!fTitle.trim()) return;
    const payload = { title: fTitle.trim(), body: fBody.trim(), roles: fRoles, required: fRequired };
    const { error } = editId
      ? await supabase.from('onboarding_items').update(payload).eq('id', editId)
      : await supabase.from('onboarding_items').insert({
          ...payload, sort_order: (items[items.length - 1]?.sort_order ?? 0) + 1
        });
    if (error) { setErr(error.message); return; }
    reset();
    load();
  };

  const remove = async (it: Item) => {
    if (!confirm(`Ta bort "${it.title}"? Avbockningar för punkten försvinner också.`)) return;
    const { error } = await supabase.from('onboarding_items').delete().eq('id', it.id);
    if (error) setErr(error.message);
    load();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const a = items[i], b = items[i + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('onboarding_items').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('onboarding_items').update({ sort_order: a.sort_order }).eq('id', b.id)
    ]);
    load();
  };

  const toggleRole = (r: Role) =>
    setFRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  if (loading) return <div className="page-sub">Laddar introduktionen…</div>;

  const incomplete = status.filter((s) => !s.complete);

  return (
    <>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      {isManager && (
        <div className="chips">
          <button className={`chip ${view === 'mina' ? 'active' : ''}`} onClick={() => setView('mina')}>Min introduktion</button>
          <button className={`chip ${view === 'hantera' ? 'active' : ''}`} onClick={() => setView('hantera')}>
            Hantera <span className="mono" style={{ marginLeft: 6, opacity: 0.7 }}>{items.length}</span>
          </button>
          <button className={`chip ${view === 'status' ? 'active' : ''}`} onClick={() => setView('status')}>
            Vem är klar <span className="mono" style={{ marginLeft: 6, opacity: 0.7 }}>{status.length - incomplete.length}/{status.length}</span>
          </button>
        </div>
      )}

      {view === 'mina' && (
        <>
          <div className="page-sub" style={{ marginBottom: 12 }}>
            {mine.length === 0 ? 'Ingen introduktion för din roll.' :
              left > 0 ? `${left} obligatoriska punkter kvar.` : 'Du är klar med introduktionen.'}
          </div>
          <div className="list">
            {mine.map((it) => (
              <div key={it.id} className="list-item">
                <div className="li-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <GraduationCap size={15} /> {it.title}
                      {!it.required && <span className="li-meta" style={{ marginTop: 0 }}>frivillig</span>}
                    </div>
                    {it.body && <div className="li-meta" style={{ whiteSpace: 'pre-wrap' }}>{it.body}</div>}
                  </div>
                  {done.has(it.id) && <span className="badge b-resolved">klar</span>}
                </div>
                {!done.has(it.id) && (
                  <div className="li-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => markDone(it)}>
                      <Check size={13} /> Läst och förstått
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'hantera' && isManager && (
        <>
          <div className="inline-form">
            <div>
              <label className="label">Rubrik</label>
              <input className="input" value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                placeholder="t.ex. Utrymningsvägar på ditt boende" />
            </div>
            <div>
              <label className="label">Text</label>
              <textarea className="textarea" value={fBody} onChange={(e) => setFBody(e.target.value)}
                placeholder="Det personen ska ha läst och förstått" />
            </div>
            <div>
              <label className="label">Gäller roller</label>
              <div className="li-meta" style={{ marginTop: 0, marginBottom: 6 }}>
                {fRoles.length === 0 ? 'Alla roller' : fRoles.map((r) => ROLE_LABELS[r]).join(', ')}
              </div>
              <div className="role-pick">
                {ROLE_GROUPS.flatMap((g) => g.roles).map((r) => (
                  <button key={r} type="button" className={`chip ${fRoles.includes(r) ? 'active' : ''}`}
                    onClick={() => toggleRole(r)}>{ROLE_LABELS[r]}</button>
                ))}
              </div>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={fRequired} onChange={() => setFRequired(!fRequired)} />
              Obligatorisk
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={save} disabled={!fTitle.trim()}>
                {editId ? 'Spara ändring' : <><Plus size={15} /> Lägg till punkt</>}
              </button>
              {editId && <button className="btn" onClick={reset}>Avbryt</button>}
            </div>
          </div>

          <div className="list">
            {items.map((it, i) => (
              <div key={it.id} className="list-item">
                <div className="li-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="li-title">{it.title}</div>
                    <div className="li-meta">
                      {it.roles.length === 0 ? 'Alla roller' : it.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
                      {it.required ? ' · obligatorisk' : ' · frivillig'}
                    </div>
                  </div>
                </div>
                <div className="li-actions">
                  <button className="move-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Flytta upp"><ArrowUp size={14} /></button>
                  <button className="move-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Flytta ner"><ArrowDown size={14} /></button>
                  <button className="btn btn-sm" onClick={() => edit(it)}><Pencil size={13} /> Ändra</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(it)}><Trash2 size={13} /> Ta bort</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="page-sub">
                Inga punkter än. Ny personal ser punkterna för sin roll på översikten tills de bockat av dem.
              </div>
            )}
          </div>
        </>
      )}

      {view === 'status' && isManager && (
        <>
          <div className="page-sub" style={{ marginBottom: 12 }}>
            {incomplete.length === 0 ? 'Alla är klara.' : `${incomplete.length} personer har obligatoriska punkter kvar.`}
          </div>
          <div className="list">
            {[...incomplete, ...status.filter((s) => s.complete)].map((s) => (
              <div key={s.user_id} className="list-item oncall-row">
                <div style={{ minWidth: 0 }}>
                  <div className="li-title">{s.full_name || '—'}</div>
                  <div className="li-meta" style={{ marginTop: 2 }}>{ROLE_LABELS[s.role] ?? s.role}</div>
                </div>
                <span className={`badge ${s.complete ? 'b-resolved' : 'b-medium'}`}>
                  {s.done_items}/{s.required_items}
                </span>
              </div>
            ))}
            {status.length === 0 && <div className="page-sub">Ingen har obligatoriska punkter än.</div>}
          </div>
        </>
      )}
    </>
  );
}
