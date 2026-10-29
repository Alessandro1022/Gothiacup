'use client';
// Checklistor på en plats: starta en körning från en mall och bocka av.
// Samma komponent för boenden och spelplatser.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';

type Template = { id: string; name: string; items: string[]; active?: boolean; cadence?: string; due_time?: string | null };
type Run = { id: string; template_id: string | null; template_name: string; status: string; created_at: string };
type Item = { id: string; run_id: string; label: string; done: boolean };

export default function ChecklistRuns({ locationType, locationId, userId }: {
  locationType: 'school' | 'arena'; locationId: string; userId: string;
}) {
  const { tr } = useLang();
  const supabase = useMemo(() => createClient(), []);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tmplId, setTmplId] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      // select('*'): active och cadence finns först efter del 19
      supabase.from('checklist_templates').select('*').eq('location_type', locationType).order('name'),
      supabase.from('checklist_runs').select('id,template_id,template_name,status,created_at')
        .eq('location_type', locationType).eq('location_id', locationId)
        .order('created_at', { ascending: false }).limit(10)
    ]);
    setTemplates(((t.data ?? []) as Template[]).filter((x) => x.active !== false));
    const runList = (r.data ?? []) as Run[];
    setRuns(runList);
    if (runList.length) {
      const { data: it } = await supabase.from('checklist_items').select('id,run_id,label,done')
        .in('run_id', runList.map((x) => x.id)).order('sort');
      setItems((it ?? []) as Item[]);
    } else setItems([]);
  }, [supabase, locationType, locationId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`checklist-${locationType}-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, supabase, locationType, locationId]);

  const startRun = async () => {
    const tmpl = templates.find((t) => t.id === tmplId);
    if (!tmpl) return;
    setErr('');
    const { data: run, error } = await supabase.from('checklist_runs')
      .insert({ template_id: tmpl.id, template_name: tmpl.name, location_type: locationType, location_id: locationId, started_by: userId })
      .select('id').single();
    if (error) {
      setErr(/row-level security/i.test(error.message)
        ? 'Du saknar behörighet till den här platsen.' : error.message);
      return;
    }
    if (run && tmpl.items.length) {
      await supabase.from('checklist_items').insert(
        tmpl.items.map((label, i) => ({ run_id: run.id, label, sort: i }))
      );
    }
    setTmplId(''); load();
  };

  const toggleItem = async (it: Item) => {
    await supabase.from('checklist_items').update({
      done: !it.done, done_by: !it.done ? userId : null, done_at: !it.done ? new Date().toISOString() : null
    }).eq('id', it.id);
    // Klarmarkera körningen automatiskt när alla punkter är klara
    const runItems = items.map((x) => (x.id === it.id ? { ...x, done: !it.done } : x)).filter((x) => x.run_id === it.run_id);
    await supabase.from('checklist_runs').update(
      runItems.every((x) => x.done)
        ? { status: 'done', completed_at: new Date().toISOString() }
        : { status: 'open', completed_at: null }
    ).eq('id', it.run_id);
    load();
  };

  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
      <div className="inline-form cols">
        <div style={{ flex: 2 }}><label className="label">{tr('checklists')}</label>
          <select className="select" value={tmplId} onChange={(e) => setTmplId(e.target.value)}>
            <option value="">Välj checklista</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={!tmplId} onClick={startRun}>
          <ClipboardCheck size={15} /> {tr('startRun')}
        </button>
      </div>
      {templates.length === 0 && (
        <div className="page-sub">Inga checklistor för den här typen av plats. Ledningen lägger upp dem under Bemanning → Checklistor.</div>
      )}
      {runs.map((r) => {
        const runItems = items.filter((i) => i.run_id === r.id);
        const doneCount = runItems.filter((i) => i.done).length;
        return (
          <div key={r.id} style={{ marginBottom: 18 }}>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div className="li-title">{r.template_name} <span className="li-meta mono">{fmt(r.created_at)}</span></div>
              <span className={`badge b-${r.status}`}>{r.status === 'done' ? tr('tDone') : `${doneCount}/${runItems.length}`}</span>
            </div>
            <div className="prog" style={{ marginBottom: 10 }}><div style={{ width: runItems.length ? `${(doneCount / runItems.length) * 100}%` : '0%' }} /></div>
            <div className="list">
              {runItems.map((it) => (
                <label key={it.id} className={`check-row ${it.done ? 'done' : ''}`}>
                  <input type="checkbox" checked={it.done} onChange={() => toggleItem(it)} /> {it.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {runs.length === 0 && templates.length > 0 && <div className="page-sub">{tr('nothingHere')}</div>}
    </>
  );
}
