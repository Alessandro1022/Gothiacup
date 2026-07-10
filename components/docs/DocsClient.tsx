'use client';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';

type Doc = { id: string; name: string; url: string; category: string; min_tier: number };

export default function DocsClient({ role }: { role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [fName, setFName] = useState(''); const [fUrl, setFUrl] = useState('');
  const [fCat, setFCat] = useState(''); const [fTier, setFTier] = useState('1');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('documents').select('id,name,url,category,min_tier').order('category').order('name');
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!fName || !fUrl) return;
    await supabase.from('documents').insert({ name: fName, url: fUrl, category: fCat || 'Övrigt', min_tier: parseInt(fTier) || 1 });
    setFName(''); setFUrl(''); setFCat(''); setFTier('1'); load();
  };
  const remove = async (d: Doc) => {
    if (!confirm(tr('confirmDelete'))) return;
    await supabase.from('documents').delete().eq('id', d.id); load();
  };

  const cats = Array.from(new Set(docs.map((d) => d.category)));

  return (
    <>
      <h1 className="page-title">{tr('docs')}</h1>
      <div className="page-sub">{tr('gComms')}</div>

      {tier >= 4 && (
        <div className="inline-form cols">
          <div><label className="label">{tr('name')}</label><input className="input" value={fName} onChange={(e) => setFName(e.target.value)} /></div>
          <div><label className="label">{tr('urlLbl')}</label><input className="input" value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" /></div>
          <div><label className="label">{tr('categoryLbl')}</label><input className="input" value={fCat} onChange={(e) => setFCat(e.target.value)} /></div>
          <div><label className="label">{tr('minTier')}</label>
            <select className="select" value={fTier} onChange={(e) => setFTier(e.target.value)}>
              {[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={add}>{tr('addDoc')}</button>
        </div>
      )}

      {loading && <div className="page-sub">{tr('loading')}</div>}
      {cats.map((cat) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>{cat}</h2>
          <div className="list">
            {docs.filter((d) => d.category === cat).map((d) => (
              <div key={d.id} className="list-item">
                <div className="li-head">
                  <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={15} style={{ color: 'var(--muted)' }} /> {d.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a className="btn btn-sm" href={d.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{tr('openDoc')}
                    </a>
                    {tier >= 4 && <button className="btn btn-sm btn-danger" onClick={() => remove(d)}>{tr('deleteLbl')}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!loading && docs.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
    </>
  );
}
