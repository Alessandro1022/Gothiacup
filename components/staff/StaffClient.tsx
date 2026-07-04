'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';
import { tierOf, type Role, ROLE_LABELS } from '@/lib/types';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

type Profile = { id: string; full_name: string; email: string; role: Role; phone: string | null };
type Scope = { id: string; user_id: string; area_id: string | null; location_type: 'school' | 'arena' | null; location_id: string | null };
type Named = { id: string; name: string };

export default function StaffClient({ viewerRole }: { viewerRole: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const canEdit = tierOf(viewerRole) >= 5; // roll + scope skrivs endast av admin+ (skyddat av RLS/trigger)
  const [people, setPeople] = useState<Profile[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [areas, setAreas] = useState<Named[]>([]);
  const [schools, setSchools] = useState<Named[]>([]);
  const [arenas, setArenas] = useState<Named[]>([]);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pick, setPick] = useState(''); // 'area:ID' | 'school:ID' | 'arena:ID'
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, sc, a, s, ar] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,role,phone').order('full_name'),
      supabase.from('staff_scope').select('id,user_id,area_id,location_type,location_id'),
      supabase.from('areas').select('id,name').order('name'),
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('arenas').select('id,name').order('name')
    ]);
    setPeople((p.data ?? []) as Profile[]);
    setScopes((sc.data ?? []) as Scope[]);
    setAreas((a.data ?? []) as Named[]);
    setSchools((s.data ?? []) as Named[]);
    setArenas((ar.data ?? []) as Named[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (id: string, role: string) => {
    setErr('');
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) setErr(error.message);
    load();
  };

  const addScope = async (userId: string) => {
    if (!pick) return;
    setErr('');
    const [kind, id] = pick.split(':');
    const row: { user_id: string; area_id: string | null; location_type: string | null; location_id: string | null } =
      kind === 'area'
        ? { user_id: userId, area_id: id, location_type: null, location_id: null }
        : { user_id: userId, area_id: null, location_type: kind, location_id: id };
    const { error } = await supabase.from('staff_scope').insert(row);
    if (error) setErr(error.message);
    setPick(''); load();
  };

  const removeScope = async (scopeId: string) => {
    setErr('');
    const { error } = await supabase.from('staff_scope').delete().eq('id', scopeId);
    if (error) setErr(error.message);
    load();
  };

  const scopeLabel = (s: Scope) => {
    if (s.area_id) return `${tenant.labels.area}: ${areas.find((a) => a.id === s.area_id)?.name ?? '?'}`;
    const list = s.location_type === 'school' ? schools : arenas;
    return `${list.find((l) => l.id === s.location_id)?.name ?? '?'}`;
  };

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  const visible = people.filter((p) =>
    !q || p.full_name?.toLowerCase().includes(q.toLowerCase()) || p.email?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <h1 className="page-title">{tr('staff')}</h1>
      <div className="page-sub">{people.length} · {tr('roleLbl').toLowerCase()} + {tr('scope').toLowerCase()}</div>

      <input className="input" placeholder="Sök namn eller e-post…" value={q}
        onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340, marginBottom: 16 }} />
      {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="list">
        {visible.map((p) => {
          const myScopes = scopes.filter((s) => s.user_id === p.id);
          const open = openId === p.id;
          return (
            <div key={p.id} className="list-item">
              <div className="li-head">
                <div>
                  <div className="li-title">{p.full_name || '—'}</div>
                  <div className="li-meta">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                </div>
                {canEdit ? (
                  <select className="select" style={{ width: 'auto', padding: '6px 9px', fontSize: 12.5 }}
                    value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                ) : (
                  <span className="badge b-low">{ROLE_LABELS[p.role]}</span>
                )}
              </div>

              <div className="li-actions">
                {myScopes.length === 0 && <span className="li-meta">{tr('noScope')}</span>}
                {myScopes.map((s) => (
                  <span key={s.id} className="badge b-resolved">
                    {scopeLabel(s)}
                    {canEdit && (
                      <button className="btn-ghost" style={{ marginLeft: 6, fontSize: 11 }}
                        onClick={() => removeScope(s.id)} title={tr('remove')}>✕</button>
                    )}
                  </span>
                ))}
                {canEdit && (
                  <button className="btn btn-sm" onClick={() => { setOpenId(open ? null : p.id); setPick(''); }}>
                    {open ? tr('cancel') : tr('assign')}
                  </button>
                )}
              </div>

              {open && canEdit && (
                <div className="inline-form cols" style={{ marginTop: 12, marginBottom: 0 }}>
                  <div>
                    <label className="label">{tr('wholeArea')} / {tr('singlePlace')}</label>
                    <select className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
                      <option value="">—</option>
                      <optgroup label={tenant.labels.areas}>
                        {areas.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.name}</option>)}
                      </optgroup>
                      <optgroup label={tenant.labels.schools}>
                        {schools.map((s) => <option key={s.id} value={`school:${s.id}`}>{s.name}</option>)}
                      </optgroup>
                      <optgroup label={tenant.labels.playingAreas}>
                        {arenas.map((a) => <option key={a.id} value={`arena:${a.id}`}>{a.name}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <button className="btn btn-primary" disabled={!pick} onClick={() => addScope(p.id)}>{tr('assign')}</button>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
