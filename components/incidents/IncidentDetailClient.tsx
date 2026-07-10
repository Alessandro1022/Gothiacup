'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';
import { tenant } from '@/lib/tenant';

type Inc = {
  id: string; title: string; description: string | null; severity: string; status: string;
  location_type: string | null; location_id: string | null;
  reported_by: string; assigned_to: string | null; created_at: string;
};
type Comment = { id: string; body: string; author: string; created_at: string };
type Opt = { id: string; name: string };
type Person = { id: string; full_name: string };

const SEVS = ['low', 'medium', 'high', 'critical'] as const;

export default function IncidentDetailClient({ incidentId, userId, role }: { incidentId: string; userId: string; role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const router = useRouter();
  const tier = tierOf(role);
  const [inc, setInc] = useState<Inc | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [schools, setSchools] = useState<Opt[]>([]);
  const [arenas, setArenas] = useState<Opt[]>([]);
  const [editing, setEditing] = useState(false);
  const [cBody, setCBody] = useState('');
  // Redigeringsfält
  const [fTitle, setFTitle] = useState(''); const [fDesc, setFDesc] = useState('');
  const [fSev, setFSev] = useState('low'); const [fLoc, setFLoc] = useState('');

  const load = useCallback(async () => {
    const [{ data: i }, { data: c }] = await Promise.all([
      supabase.from('incidents').select('id,title,description,severity,status,location_type,location_id,reported_by,assigned_to,created_at').eq('id', incidentId).single(),
      supabase.from('incident_comments').select('id,body,author,created_at').eq('incident_id', incidentId).order('created_at')
    ]);
    if (i) {
      setInc(i as Inc);
      setFTitle(i.title); setFDesc(i.description ?? ''); setFSev(i.severity);
      setFLoc(i.location_type && i.location_id ? `${i.location_type}:${i.location_id}` : '');
    }
    setComments((c ?? []) as Comment[]);
  }, [supabase, incidentId]);

  useEffect(() => {
    load();
    supabase.from('profiles').select('id,full_name').then(({ data }) => setPeople((data ?? []) as Person[]));
    supabase.from('schools').select('id,name').then(({ data }) => setSchools((data ?? []) as Opt[]));
    supabase.from('arenas').select('id,name').then(({ data }) => setArenas((data ?? []) as Opt[]));
    const ch = supabase.channel(`inc-${incidentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_comments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (!inc) return <div className="page-sub">{tr('loading')}</div>;

  const name = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? '—';
  const locName = () => {
    if (!inc.location_type || !inc.location_id) return tr('none');
    const list = inc.location_type === 'school' ? schools : arenas;
    return list.find((x) => x.id === inc.location_id)?.name ?? '—';
  };
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const sevLabel = (s: string) => s === 'low' ? tr('sevLow') : s === 'medium' ? tr('sevMedium') : s === 'high' ? tr('sevHigh') : tr('sevCritical');
  const stLabel = (s: string) => s === 'open' ? tr('stOpen') : s === 'in_progress' ? tr('stInProgress') : tr('stResolved');

  const setStatus = async (status: string) => {
    await supabase.from('incidents').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', inc.id);
    load();
  };
  const setAssignee = async (id: string) => {
    await supabase.from('incidents').update({ assigned_to: id || null }).eq('id', inc.id);
    load();
  };
  const saveEdit = async () => {
    const [lt, li] = fLoc ? fLoc.split(':') : [null, null];
    await supabase.from('incidents').update({
      title: fTitle, description: fDesc || null, severity: fSev,
      location_type: lt, location_id: li
    }).eq('id', inc.id);
    setEditing(false); load();
  };
  const remove = async () => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('incidents').delete().eq('id', inc.id);
    router.push('/incidents');
  };
  const addComment = async () => {
    const body = cBody.trim();
    if (!body) return;
    setCBody('');
    await supabase.from('incident_comments').insert({ incident_id: inc.id, body, author: userId });
  };

  const canEdit = tier >= 3 || inc.reported_by === userId;

  return (
    <>
      <Link href="/incidents" className="btn btn-sm btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={14} /> {tr('back')}
      </Link>

      {!editing ? (
        <>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{inc.title}</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className={`badge b-${inc.severity}`}>{sevLabel(inc.severity)}</span>
              <span className={`badge b-${inc.status}`}>{stLabel(inc.status)}</span>
            </div>
          </div>
          <div className="page-sub">{locName()} · {tr('createdLbl').toLowerCase()} {fmt(inc.created_at)}</div>

          {inc.description && <div className="card" style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>{inc.description}</div>}

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="stat-row"><span>{tr('reportedBy')}</span><b>{name(inc.reported_by)}</b></div>
            <div className="stat-row" style={{ alignItems: 'center' }}>
              <span>{tr('assignedTo')}</span>
              <select className="select" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                value={inc.assigned_to ?? ''} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">{tr('unassigned')}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="li-actions" style={{ marginBottom: 20 }}>
            {inc.status === 'open' && <button className="btn btn-sm" onClick={() => setStatus('in_progress')}>{tr('markInProgress')}</button>}
            {inc.status !== 'resolved' && <button className="btn btn-sm btn-primary" onClick={() => setStatus('resolved')}>{tr('markResolved')}</button>}
            {inc.status === 'resolved' && <button className="btn btn-sm" onClick={() => setStatus('open')}>{tr('reopen')}</button>}
            {canEdit && <button className="btn btn-sm" onClick={() => setEditing(true)}>{tr('edit')}</button>}
            {canEdit && <button className="btn btn-sm btn-danger" onClick={remove}>{tr('deleteLbl')}</button>}
          </div>
        </>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <label className="label">{tr('title')}</label>
          <input className="input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
          <label className="label">{tr('description')}</label>
          <textarea className="textarea" value={fDesc} onChange={(e) => setFDesc(e.target.value)} />
          <label className="label">{tr('severity')}</label>
          <select className="select" value={fSev} onChange={(e) => setFSev(e.target.value)}>
            {SEVS.map((s) => <option key={s} value={s}>{sevLabel(s)}</option>)}
          </select>
          <label className="label">{tr('location')}</label>
          <select className="select" value={fLoc} onChange={(e) => setFLoc(e.target.value)}>
            <option value="">{tr('none')}</option>
            <optgroup label={tenant.labels.schools}>
              {schools.map((s) => <option key={s.id} value={`school:${s.id}`}>{s.name}</option>)}
            </optgroup>
            <optgroup label={tenant.labels.playingAreas}>
              {arenas.map((a) => <option key={a.id} value={`arena:${a.id}`}>{a.name}</option>)}
            </optgroup>
          </select>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(false)}>{tr('cancel')}</button>
            <button className="btn btn-primary" onClick={saveEdit}>{tr('save')}</button>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>{tr('comments')} <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{comments.length}</span></h2>
      <div className="list" style={{ marginBottom: 12 }}>
        {comments.map((c) => (
          <div key={c.id} className="list-item">
            <div className="li-title" style={{ fontSize: 13.5, fontWeight: 600 }}>{name(c.author)} <span className="li-meta mono" style={{ display: 'inline' }}>· {fmt(c.created_at)}</span></div>
            <div style={{ fontSize: 14, marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.body}</div>
          </div>
        ))}
        {comments.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
      <div className="chat-input" style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--panel)' }}>
        <input className="input" placeholder={tr('writeMsg')} value={cBody}
          onChange={(e) => setCBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }} />
        <button className="btn btn-primary" onClick={addComment}>{tr('send')}</button>
      </div>
    </>
  );
}
