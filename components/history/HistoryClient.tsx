'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';

type Entry = { id: string; table_name: string; record_id: string; action: string; actor: string | null; changes: Record<string, unknown> | null; created_at: string };

export const TABLE_LABELS: Record<string, string> = {
  incidents: 'Incident', tasks: 'Uppgift', staff_scope: 'Behörighet', shifts: 'Pass',
  room_keys: 'Nyckel', team_assignments: 'Lag', arena_matches: 'Match',
  classrooms: 'Klassrum', room_issues: 'Felanmälan', news_posts: 'Nyhet', documents: 'Dokument'
};
export const ACTION_LABELS: Record<string, string> = { INSERT: 'Skapad', UPDATE: 'Ändrad', DELETE: 'Raderad' };
export const actionBadge = (a: string) => a === 'INSERT' ? 'b-resolved' : a === 'UPDATE' ? 'b-medium' : 'b-critical';

export function entryTitle(e: Entry): string {
  const c = e.changes ?? {};
  const pick = c.title ?? c.team_name ?? c.name ?? c.label ?? (c.home_team ? `${c.home_team} – ${c.away_team}` : '');
  return String(pick).slice(0, 60) || e.record_id.slice(0, 8);
}

export default function HistoryClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [table, setTable] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let q = supabase.from('audit_log')
      .select('id,table_name,record_id,action,actor,changes,created_at')
      .order('created_at', { ascending: false }).limit(150);
    if (table) q = q.eq('table_name', table);
    const { data } = await q;
    setEntries((data ?? []) as Entry[]);
    setLoading(false);
  }, [supabase, table]);

  useEffect(() => {
    load();
    supabase.from('profiles').select('id,full_name').then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name])));
    });
  }, [load, supabase]);

  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <h1 className="page-title">{tr('history')}</h1>
      <div className="page-sub">{tr('historySub')}</div>

      <div className="chips">
        <button className={`chip ${table === '' ? 'active' : ''}`} onClick={() => setTable('')}>{tr('all')}</button>
        {Object.entries(TABLE_LABELS).map(([k, v]) => (
          <button key={k} className={`chip ${table === k ? 'active' : ''}`} onClick={() => setTable(k)}>{v}</button>
        ))}
      </div>

      {loading && <div className="page-sub">{tr('loading')}</div>}
      <div className="list">
        {entries.map((e) => (
          <div key={e.id} className="list-item">
            <div className="li-head">
              <div>
                <div className="li-title" style={{ fontSize: 14 }}>
                  {TABLE_LABELS[e.table_name] ?? e.table_name}: {entryTitle(e)}
                </div>
                <div className="li-meta mono">{fmt(e.created_at)} · {e.actor ? (names[e.actor] ?? '—') : 'System'}</div>
              </div>
              <span className={`badge ${actionBadge(e.action)}`}>{ACTION_LABELS[e.action] ?? e.action}</span>
            </div>
          </div>
        ))}
        {!loading && entries.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
