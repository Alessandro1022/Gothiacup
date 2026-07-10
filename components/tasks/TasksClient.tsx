'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';

type Task = {
  id: string; title: string; description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'normal' | 'high';
  assigned_to: string | null;
};
type Person = { id: string; full_name: string };

const ORDER: Task['status'][] = ['todo', 'in_progress', 'done'];

export default function TasksClient({ userId }: { userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fPrio, setFPrio] = useState<Task['priority']>('normal');
  const [fAssign, setFAssign] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (t: Task) => {
    setEditId(t.id);
    setFTitle(t.title); setFDesc(t.description ?? '');
    setFPrio(t.priority); setFAssign(t.assigned_to ?? '');
    setShowModal(true);
  };
  const openNew = () => {
    setEditId(null);
    setFTitle(''); setFDesc(''); setFPrio('normal'); setFAssign('');
    setShowModal(true);
  };
  const removeTask = async (t: Task) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('tasks').delete().eq('id', t.id);
    load();
  };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id,title,description,status,priority,assigned_to')
      .order('created_at', { ascending: false });
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('profiles').select('id,full_name').then(({ data }) => setPeople(data ?? []));
    const ch = supabase.channel('tasks-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const move = async (t: Task, dir: -1 | 1) => {
    const idx = ORDER.indexOf(t.status) + dir;
    if (idx < 0 || idx >= ORDER.length) return;
    await supabase.from('tasks').update({ status: ORDER[idx] }).eq('id', t.id);
    load();
  };

  const assign = async (t: Task, uid: string) => {
    await supabase.from('tasks').update({ assigned_to: uid || null }).eq('id', t.id);
    load();
  };

  const saveTask = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('tasks').update({
        title: fTitle, description: fDesc || null, priority: fPrio,
        assigned_to: fAssign || null
      }).eq('id', editId);
    } else {
      await supabase.from('tasks').insert({
        title: fTitle, description: fDesc || null, priority: fPrio,
        assigned_to: fAssign || null, created_by: userId
      });
    }
    setSaving(false);
    setShowModal(false); setEditId(null);
    setFTitle(''); setFDesc(''); setFPrio('normal'); setFAssign('');
    load();
  };

  const colTitle = (s: Task['status']) =>
    tr(s === 'todo' ? 'tTodo' : s === 'in_progress' ? 'tInProgress' : 'tDone');
  const prName = (id: string | null) =>
    people.find((p) => p.id === id)?.full_name || tr('unassigned');

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">{tr('tasks')}</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={15} style={{ verticalAlign: -2, marginRight: 5 }} />{tr('newTask')}
        </button>
      </div>

      {loading && <div className="page-sub">{tr('loading')}</div>}

      <div className="kanban">
        {ORDER.map((col) => {
          const inCol = tasks.filter((t) => t.status === col);
          return (
            <div key={col} className="kanban-col">
              <div className="kanban-head">
                <span>{colTitle(col)}</span><span className="mono">{inCol.length}</span>
              </div>
              {inCol.map((t) => (
                <div key={t.id} className="kanban-card">
                  <div className="kc-title" style={{ cursor: 'pointer' }} onClick={() => openEdit(t)}>{t.title}</div>
                  <div className="kc-meta">
                    <span className={`badge b-${t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium'}`}>
                      {tr(t.priority === 'low' ? 'prLow' : t.priority === 'high' ? 'prHigh' : 'prNormal')}
                    </span>
                    {' '}· {prName(t.assigned_to)}
                  </div>
                  <div className="kc-actions">
                    <button className="move-btn" disabled={col === 'todo'} onClick={() => move(t, -1)} aria-label="Flytta vänster">
                      <ChevronLeft size={15} />
                    </button>
                    <select className="select" style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                      value={t.assigned_to ?? ''} onChange={(e) => assign(t, e.target.value)}>
                      <option value="">{tr('unassigned')}</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 6)}</option>)}
                    </select>
                    <button className="move-btn" disabled={col === 'done'} onClick={() => move(t, 1)} aria-label="Flytta höger">
                      <ChevronRight size={15} />
                    </button>
                    <button className="move-btn" onClick={() => removeTask(t)} aria-label="Radera">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? tr('edit') : tr('newTask')}</h3>

            <label className="label">{tr('title')}</label>
            <input className="input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />

            <label className="label">{tr('description')}</label>
            <textarea className="textarea" value={fDesc} onChange={(e) => setFDesc(e.target.value)} />

            <label className="label">{tr('priority')}</label>
            <select className="select" value={fPrio} onChange={(e) => setFPrio(e.target.value as Task['priority'])}>
              <option value="low">{tr('prLow')}</option>
              <option value="normal">{tr('prNormal')}</option>
              <option value="high">{tr('prHigh')}</option>
            </select>

            <label className="label">{tr('assign')}</label>
            <select className="select" value={fAssign} onChange={(e) => setFAssign(e.target.value)}>
              <option value="">{tr('unassigned')}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 6)}</option>)}
            </select>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>{tr('cancel')}</button>
              <button className="btn btn-primary" disabled={!fTitle || saving} onClick={saveTask}>{tr('create')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
