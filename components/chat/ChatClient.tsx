'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';
import { tenant } from '@/lib/tenant';

type Msg = { id: string; channel: string; body: string; sender: string; created_at: string };
type Area = { id: string; name: string };

export default function ChatClient({ userId, role }: { userId: string; role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [channel, setChannel] = useState('global');
  const [areas, setAreas] = useState<Area[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('messages')
      .select('id,channel,body,sender,created_at')
      .eq('channel', channel).order('created_at').limit(200);
    if (error) setErr(error.message);
    setMsgs((data ?? []) as Msg[]);
  }, [supabase, channel]);

  useEffect(() => {
    const loadAreas = async () => {
      if (tier >= 5) {
        const { data } = await supabase.from('areas').select('id,name').order('name');
        setAreas(data ?? []);
      } else {
        const { data: sc } = await supabase.from('staff_scope')
          .select('area_id').eq('user_id', userId).not('area_id', 'is', null);
        const ids = (sc ?? []).map((s) => s.area_id);
        if (ids.length) {
          const { data } = await supabase.from('areas').select('id,name').in('id', ids).order('name');
          setAreas(data ?? []);
        }
      }
    };
    loadAreas();
    supabase.from('profiles').select('id,full_name').then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`chat-${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Msg;
        if (m.channel !== channel) return;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setErr('');
    const { data, error } = await supabase.from('messages')
      .insert({ channel, body, sender: userId })
      .select('id,channel,body,sender,created_at')
      .single();
    if (error) {
      setErr(error.message);
    } else {
      setText('');
      // Visa direkt, även om realtidshändelsen dröjer
      if (data) setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
    }
    setSending(false);
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <h1 className="page-title">{tr('chat')}</h1>
      <div className="page-sub">{tenant.event.name}</div>

      <div className="chips">
        <button className={`chip ${channel === 'global' ? 'active' : ''}`} onClick={() => setChannel('global')}>
          {tr('general')}
        </button>
        {tier >= 4 && (
          <button className={`chip ${channel === 'leadership' ? 'active' : ''}`} onClick={() => setChannel('leadership')}>
            {tr('leadershipCh')}
          </button>
        )}
        {areas.map((a) => (
          <button key={a.id} className={`chip ${channel === `area:${a.id}` ? 'active' : ''}`}
            onClick={() => setChannel(`area:${a.id}`)}>{a.name}</button>
        ))}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="chat-box">
        <div className="chat-msgs">
          {msgs.map((m) => (
            <div key={m.id} className={`chat-msg ${m.sender === userId ? 'mine' : ''}`}>
              <div className="chat-bubble">{m.body}</div>
              <div className="chat-meta">
                {m.sender === userId ? '' : `${names[m.sender] ?? '—'} · `}{fmt(m.created_at)}
              </div>
            </div>
          ))}
          {msgs.length === 0 && <div className="page-sub" style={{ marginBottom: 0 }}>{tr('nothingHere')}</div>}
          <div ref={endRef} />
        </div>

        <div className="chat-input">
          <input
            className="input"
            style={{ minWidth: 0, flex: 1 }}
            placeholder={tr('writeMsg')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            enterKeyHint="send"
          />
          <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
            <Send size={16} /> <span className="send-label">{tr('send')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
