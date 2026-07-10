'use client';
import { useCallback, useEffect, useState } from 'react';
import { Pin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';

type Post = { id: string; title: string; body: string | null; pinned: boolean; min_tier: number; created_by: string; created_at: string };

export default function NewsClient({ userId, role }: { userId: string; role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [posts, setPosts] = useState<Post[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [fTitle, setFTitle] = useState(''); const [fBody, setFBody] = useState(''); const [fTier, setFTier] = useState('1');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('news_posts')
      .select('id,title,body,pinned,min_tier,created_by,created_at')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
    setPosts((data ?? []) as Post[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('profiles').select('id,full_name').then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name])));
    });
    const ch = supabase.channel('news-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_posts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const publish = async () => {
    if (!fTitle) return;
    await supabase.from('news_posts').insert({ title: fTitle, body: fBody || null, min_tier: parseInt(fTier) || 1, created_by: userId });
    setFTitle(''); setFBody(''); setFTier('1'); load();
  };
  const togglePin = async (p: Post) => { await supabase.from('news_posts').update({ pinned: !p.pinned }).eq('id', p.id); load(); };
  const remove = async (p: Post) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('news_posts').delete().eq('id', p.id); load();
  };

  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <h1 className="page-title">{tr('news')}</h1>
      <div className="page-sub">{tr('gComms')}</div>

      {tier >= 4 && (
        <div className="inline-form">
          <div><label className="label">{tr('title')}</label><input className="input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} /></div>
          <div><label className="label">{tr('description')}</label><textarea className="textarea" value={fBody} onChange={(e) => setFBody(e.target.value)} /></div>
          <div><label className="label">{tr('minTier')}</label>
            <select className="select" value={fTier} onChange={(e) => setFTier(e.target.value)}>
              {[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={publish}>{tr('newPost')}</button>
        </div>
      )}

      {loading && <div className="page-sub">{tr('loading')}</div>}
      <div className="list">
        {posts.map((p) => (
          <div key={p.id} className="list-item">
            <div className="li-head">
              <div>
                <div className="li-title">{p.pinned && <Pin size={13} style={{ verticalAlign: -1, marginRight: 5, color: 'var(--primary)' }} />}{p.title}</div>
                {p.body && <div className="li-meta" style={{ whiteSpace: 'pre-wrap' }}>{p.body}</div>}
                <div className="li-meta mono">{fmt(p.created_at)} · {names[p.created_by] ?? '—'}</div>
              </div>
            </div>
            {(tier >= 5 || p.created_by === userId) && (
              <div className="li-actions">
                <button className="btn btn-sm" onClick={() => togglePin(p)}>{p.pinned ? tr('unpin') : tr('pin')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>{tr('deleteLbl')}</button>
              </div>
            )}
          </div>
        ))}
        {!loading && posts.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
