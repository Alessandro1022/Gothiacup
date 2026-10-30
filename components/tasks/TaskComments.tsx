'use client';
// Kommentarer på en uppgift. Ser du uppgiften ser du kommentarerna, och du
// kan bara skriva i eget namn (del 22).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Comment = { id: string; body: string; author: string | null; created_at: string };

export default function TaskComments({ taskId, userId, names }: {
  taskId: string; userId: string; names: Record<string, string>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('task_comments')
      .select('id,body,author,created_at').eq('task_id', taskId).order('created_at');
    if (error) { setErr(error.message); return; }
    setList((data ?? []) as Comment[]);
  }, [supabase, taskId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`task-comments-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, supabase, taskId]);

  const send = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true); setErr('');
    const { error } = await supabase.from('task_comments').insert({ task_id: taskId, body: text, author: userId });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setBody('');
    load();
  };

  const remove = async (c: Comment) => {
    if (!confirm('Ta bort kommentaren?')) return;
    await supabase.from('task_comments').delete().eq('id', c.id);
    load();
  };

  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="comments">
      {list.map((c) => (
        <div key={c.id} className="comment">
          <div className="comment-head">
            <b>{(c.author && names[c.author]) || '—'}</b>
            <span className="li-meta mono" style={{ marginTop: 0 }}>{fmt(c.created_at)}</span>
            {c.author === userId && (
              <button className="att-del inline" onClick={() => remove(c)} aria-label="Ta bort kommentar"><Trash2 size={12} /></button>
            )}
          </div>
          <div className="comment-body">{c.body}</div>
        </div>
      ))}
      {list.length === 0 && <div className="li-meta" style={{ marginTop: 0 }}>Inga kommentarer än.</div>}
      {err && <div className="form-error">{err}</div>}
      <div className="chat-input comment-input">
        <input className="input" placeholder="Skriv en kommentar…" value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} enterKeyHint="send" />
        <button className="btn btn-primary" onClick={send} disabled={!body.trim() || busy} aria-label="Skicka kommentar">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
