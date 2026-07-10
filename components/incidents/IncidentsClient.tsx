'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

type Inc = {
  id: string; title: string; description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  location_type: 'school' | 'arena' | null; location_id: string | null;
  created_at: string;
};
type Loc = { id: string; name: string };

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function IncidentsClient({ userId }: { userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const [items, setItems] = useState<Inc[]>([]);
  const [schools, setSchools] = useState<Loc[]>([]);
  const [arenas, setArenas] = useState<Loc[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Formulär
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fSev, setFSev] = useState<Inc['severity']>('medium');
  const [fLoc, setFLoc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('incidents')
      .select('id,title,description,severity,status,location_type,location_id,created_at')
      .order('created_at', { ascending: false });
    setItems((data ?? []) as Inc[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('schools').select('id,name').then(({ data }) => setSchools(data ?? []));
    supabase.from('arenas').select('id,name').then(({ data }) => setArenas(data ?? []));
    const ch = supabase.channel('inc-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const createIncident = async () => {
    setSaving(true);
    const [lt, lid] = fLoc ? fLoc.split(':') : [null, null];
    await supabase.from('incidents').insert({
      title: fTitle, description: fDesc || null, severity: fSev,
      location_type: lt, location_id: lid, reported_by: userId
    });
    setSaving(false);
    setShowModal(false);
    setFTitle(''); setFDesc(''); setFSev('medium'); setFLoc('');
    load();
  };

  const setStatus = async (id: string, status: Inc['status']) => {
    await supabase.from('incidents').update({
      status, resolved_at: status === 'resolved' ? new Date().toISOString() : null
    }).eq('id', id);
    load();
  };

  const locName = (i: Inc) => {
    if (!i.location_id) return null;
    const list = i.location_type === 'school' ? schools : arenas;
    return list.find((l) => l.id === i.location_id)?.name ?? null;
  };

  const sevLabel = (s: string) => tr((s === 'low' ? 'sevLow' : s === 'medium' ? 'sevMedium' : s === 'high' ? 'sevHigh' : 'sevCritical'));
  const stLabel = (s: string) => tr((s === 'open' ? 'stOpen' : s === 'in_progress' ? 'stInProgress' : 'stResolved'));

  const visible = items.filter((i) => filter === 'all' || i.severity === filter);

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title">{tr('incidents')}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} style={{ verticalAlign: -2, marginRight: 5 }} />{tr('newIncident')}
        </button>
      </div>

      <div className="chips">
        <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{tr('all')}</button>
        {SEVERITIES.map((s) => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{sevLabel(s)}</button>
        ))}
      </div>

      {loading && <div className="page-sub">{tr('loading')}</div>}
      <div className="list">
        {!loading && visible.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
        {visible.map((i) => (
          <div key={i.id} className="list-item">
            <div className="li-head">
              <div>
                <Link href={`/incidents/${i.id}`} className="li-title" style={{ display: 'block', textDecoration: 'underline', textDecorationColor: 'var(--line)', textUnderlineOffset: 3 }}>{i.title}</Link>
                {i.description && <div className="li-meta">{i.description}</div>}
                <div className="li-meta mono">
                  {new Date(i.created_at).toLocaleString('sv-SE')}
                  {locName(i) ? ` · ${locName(i)}` : ''}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 5, justifyItems: 'end' }}>
                <span className={`badge b-${i.severity}`}>{sevLabel(i.severity)}</span>
                <span className={`badge b-${i.status}`}>{stLabel(i.status)}</span>
              </div>
            </div>
            <div className="li-actions">
              {i.status === 'open' && (
                <button className="btn btn-sm" onClick={() => setStatus(i.id, 'in_progress')}>{tr('markInProgress')}</button>
              )}
              {i.status !== 'resolved' && (
                <button className="btn btn-sm" onClick={() => setStatus(i.id, 'resolved')}>{tr('markResolved')}</button>
              )}
              {i.status === 'resolved' && (
                <button className="btn btn-sm" onClick={() => setStatus(i.id, 'open')}>{tr('reopen')}</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{tr('newIncident')}</h3>

            <label className="label">{tr('title')}</label>
            <input className="input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />

            <label className="label">{tr('description')}</label>
            <textarea className="textarea" value={fDesc} onChange={(e) => setFDesc(e.target.value)} />

            <label className="label">{tr('severity')}</label>
            <select className="select" value={fSev} onChange={(e) => setFSev(e.target.value as Inc['severity'])}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{sevLabel(s)}</option>)}
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
              <button className="btn" onClick={() => setShowModal(false)}>{tr('cancel')}</button>
              <button className="btn btn-primary" disabled={!fTitle || saving} onClick={createIncident}>{tr('create')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
