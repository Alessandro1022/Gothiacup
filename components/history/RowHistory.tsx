'use client';
// Ändringshistorik för ett enskilt objekt (visas t.ex. på incidentdetaljen)
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { ACTION_LABELS, actionBadge } from '@/components/history/HistoryClient';

type Entry = { id: string; action: string; actor: string | null; created_at: string };

export default function RowHistory({ recordId }: { recordId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('audit_log').select('id,action,actor,created_at')
      .eq('record_id', recordId).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setEntries((data ?? []) as Entry[]));
    supabase.from('profiles').select('id,full_name').then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId]);

  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ marginTop: 18 }}>
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {tr('history')} </button>
      {open && (
        <div className="list" style={{ marginTop: 8 }}>
          {entries.map((e) => (
            <div key={e.id} className="list-item" style={{ padding: '9px 13px' }}>
              <div className="li-head">
                <div className="li-meta mono" style={{ marginTop: 0 }}>{fmt(e.created_at)} · {e.actor ? (names[e.actor] ?? '—') : 'System'}</div>
                <span className={`badge ${actionBadge(e.action)}`}>{ACTION_LABELS[e.action] ?? e.action}</span>
              </div>
            </div>
          ))}
          {entries.length === 0 && <div className="page-sub" style={{ marginBottom: 0 }}>{tr('nothingHere')}</div>}
        </div>
      )}
    </div>
  );
}
