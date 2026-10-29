'use client';
// Måltidsrättigheter: vilka lag som äter vilka mål, och i vilken matsal.
// Utan dem nekas alla vid avprickningen och prognosen blir tom, så det här
// är det första matansvarig gör inför turneringen.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Team = {
  id: string; team_name: string; school_id: string; school_name: string;
  arrival_date: string | null; departure_date: string | null;
};
type Hall = { id: string; name: string; active: boolean };
type Ent = { id: string; team_assignment_id: string; hall_id: string | null; meal: string };

const MEALS = ['frukost', 'lunch', 'middag', 'kvall'] as const;
const MEAL_SHORT: Record<string, string> = { frukost: 'Frukost', lunch: 'Lunch', middag: 'Middag', kvall: 'Kväll' };

export default function EntitlementsTab({ canWrite, onChange }: { canWrite: boolean; onChange?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [teams, setTeams] = useState<Team[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [ents, setEnts] = useState<Ent[]>([]);
  const [school, setSchool] = useState('');
  const [hall, setHall] = useState('');
  const [bulkMeals, setBulkMeals] = useState<string[]>(['frukost', 'middag']);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, h, e] = await Promise.all([
      supabase.from('meal_teams').select('*').order('team_name'),
      supabase.from('dining_halls').select('id,name,active').order('name'),
      supabase.from('meal_entitlements').select('id,team_assignment_id,hall_id,meal')
    ]);
    let list = (t.data ?? []) as Team[];
    if (t.error) {
      // Utan del 22 finns inte meal_teams: läs lagen direkt, med lagens
      // egen behörighet. Ledningen ser då alla, övriga bara sina boenden.
      const f = await supabase.from('team_assignments')
        .select('id,team_name,school_id,arrival_date,departure_date,schools(name)').order('team_name');
      if (f.error) setErr(`Lagen gick inte att läsa: ${f.error.message}`);
      list = ((f.data ?? []) as unknown as (Omit<Team, 'school_name'> & { schools: { name: string } | null })[])
        .map((x) => ({ ...x, school_name: x.schools?.name ?? '—' }));
    }
    setTeams(list);
    const hl = ((h.data ?? []) as Hall[]).filter((x) => x.active);
    setHalls(hl);
    setHall((cur) => cur || hl[0]?.id || '');
    setEnts((e.data ?? []) as Ent[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const schools = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.school_id, t.school_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sv'));
  }, [teams]);

  const needle = q.trim().toLowerCase();
  const shown = teams.filter((t) => (!school || t.school_id === school)
    && (!needle || t.team_name.toLowerCase().includes(needle)));

  const entOf = (teamId: string, meal: string) =>
    ents.find((e) => e.team_assignment_id === teamId && e.meal === meal);
  const hallName = (id: string | null) => halls.find((h) => h.id === id)?.name ?? 'ingen matsal';

  const toggle = async (t: Team, meal: string) => {
    if (!canWrite) return;
    setErr(''); setMsg('');
    const cur = entOf(t.id, meal);
    if (cur) {
      const { error } = await supabase.from('meal_entitlements').delete().eq('id', cur.id);
      if (error) { setErr(error.message); return; }
    } else {
      if (!hall) { setErr('Välj en matsal först.'); return; }
      const { error } = await supabase.from('meal_entitlements')
        .insert({ team_assignment_id: t.id, meal, hall_id: hall });
      if (error) { setErr(error.message); return; }
    }
    await load();
    onChange?.();
  };

  // Samma rättigheter för alla lag i urvalet. Finns målet redan byts bara matsalen.
  const applyBulk = async (remove: boolean) => {
    if (!canWrite || shown.length === 0 || bulkMeals.length === 0) return;
    if (!remove && !hall) { setErr('Välj en matsal först.'); return; }
    if (remove && !confirm(`Ta bort ${bulkMeals.map((m) => MEAL_SHORT[m].toLowerCase()).join(', ')} för ${shown.length} lag?`)) return;
    setBusy(true); setErr(''); setMsg('');
    const ids = shown.map((t) => t.id);
    const { error } = remove
      ? await supabase.from('meal_entitlements').delete()
          .in('team_assignment_id', ids).in('meal', bulkMeals)
      : await supabase.from('meal_entitlements').upsert(
          ids.flatMap((id) => bulkMeals.map((meal) => ({ team_assignment_id: id, meal, hall_id: hall }))),
          { onConflict: 'team_assignment_id,meal' }
        );
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(remove ? `Borttaget för ${ids.length} lag.` : `${ids.length} lag har fått ${bulkMeals.map((m) => MEAL_SHORT[m].toLowerCase()).join(', ')} i ${hallName(hall)}.`);
    await load();
    onChange?.();
  };

  if (loading) return <div className="page-sub">Laddar lagen…</div>;

  const withAny = teams.filter((t) => ents.some((e) => e.team_assignment_id === t.id)).length;

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 12 }}>
        {withAny} av {teams.length} lag har minst ett mål. Prognosen räknar på
        rättigheterna och lagens registrerade deltagare.
      </div>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
      {msg && <div className="ok-msg" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="inline-form cols">
        <div>
          <label className="label">Boende</label>
          <select className="select" value={school} onChange={(e) => setSchool(e.target.value)}>
            <option value="">Alla boenden</option>
            {schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Matsal</label>
          <select className="select" value={hall} onChange={(e) => setHall(e.target.value)}>
            {halls.length === 0 && <option value="">Lägg upp en matsal först</option>}
            {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label className="label">Sök lag</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {canWrite && shown.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="li-title" style={{ fontSize: 14 }}>Alla {shown.length} lag i urvalet</div>
          <div className="chips" style={{ margin: '10px 0 8px', padding: 0, flexWrap: 'wrap' }}>
            {MEALS.map((m) => (
              <button key={m} className={`chip ${bulkMeals.includes(m) ? 'active' : ''}`}
                onClick={() => setBulkMeals((cur) => cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m])}>
                {MEAL_SHORT[m]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-primary" disabled={busy || !hall || bulkMeals.length === 0} onClick={() => applyBulk(false)}>
              <Plus size={14} /> Ge rättighet
            </button>
            <button className="btn btn-sm btn-danger" disabled={busy || bulkMeals.length === 0} onClick={() => applyBulk(true)}>
              <Trash2 size={14} /> Ta bort
            </button>
          </div>
        </div>
      )}

      <div className="list">
        {shown.map((t) => (
          <div key={t.id} className="list-item" style={{ padding: '12px 14px' }}>
            <div className="li-title" style={{ fontSize: 15 }}>{t.team_name}</div>
            <div className="li-meta" style={{ marginTop: 2 }}>
              {t.school_name}{t.arrival_date ? ` · ${t.arrival_date} – ${t.departure_date ?? '?'}` : ''}
            </div>
            <div className="meal-toggles">
              {MEALS.map((m) => {
                const e = entOf(t.id, m);
                return (
                  <button key={m} className={`meal-toggle ${e ? 'on' : ''}`} disabled={!canWrite}
                    title={e ? hallName(e.hall_id) : 'Ingen rätt'} onClick={() => toggle(t, m)}>
                    {e && <Check size={12} />} {MEAL_SHORT[m]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="page-sub">{teams.length === 0 ? 'Inga lag registrerade på boendena än.' : 'Inga lag matchar.'}</div>
        )}
      </div>
    </>
  );
}
