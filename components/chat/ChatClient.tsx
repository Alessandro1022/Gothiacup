'use client';
// Chatt med riktiga kanaler. Tidigare var kanalen en fri sträng, vilket
// fungerar så länge allt är öppet men inte går att svara på frågan "vem får
// läsa den här?" så fort det finns privata samtal. Nu styr medlemskapet.
//
// Direktmeddelanden är aldrig öppna, oavsett behörighet: ledningen ska inte
// kunna läsa personalens privata samtal för att de står högre i organisationen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Plus, AlertTriangle, ListPlus, Languages, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';
import { useTenant } from '@/components/TenantProvider';

type Msg = {
  id: string; channel_id: string | null; body: string; sender: string;
  created_at: string; priority: boolean; task_id: string | null;
  translated_body: string; translated_to: string;
};
type Channel = {
  id: string; kind: string; name: string; is_open: boolean; min_tier: number;
};
type Person = { id: string; full_name: string };

const KIND_LABEL: Record<string, string> = {
  global: 'Alla', grupp: 'Grupp', plats: 'Plats', direkt: 'Direkt', lagledare: 'Lagledare'
};

export default function ChatClient({ userId, role }: { userId: string; role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tn = useTenant();
  const tier = tierOf(role);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [newDm, setNewDm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('channels').select('id,kind,name,is_open,min_tier').order('kind'),
      supabase.from('profiles').select('id,full_name').order('full_name')
    ]);
    const list = (c.data ?? []) as Channel[];
    setChannels(list);
    const ppl = (p.data ?? []) as Person[];
    setPeople(ppl.filter((x) => x.id !== userId));
    setNames(Object.fromEntries(ppl.map((x) => [x.id, x.full_name])));
    setActive((cur) => cur ?? list[0]?.id ?? null);
  }, [supabase, userId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const load = useCallback(async () => {
    if (!active) { setMsgs([]); return; }
    const { data, error } = await supabase.from('messages')
      .select('id,channel_id,body,sender,created_at,priority,task_id,translated_body,translated_to')
      .eq('channel_id', active).order('created_at').limit(200);
    if (error) setErr(error.message);
    setMsgs((data ?? []) as Msg[]);
  }, [supabase, active]);

  useEffect(() => {
    load();
    if (!active) return;
    const ch = supabase.channel(`chat-${active}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Msg;
        if (m.channel_id !== active) return;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    // Markera som läst när kanalen öppnas
    supabase.from('channel_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', active).eq('user_id', userId).then(() => {});
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !active) return;
    setSending(true); setErr('');
    const { data, error } = await supabase.from('messages')
      .insert({ channel: 'kanal', channel_id: active, body, sender: userId, priority })
      .select('id,channel_id,body,sender,created_at,priority,task_id,translated_body,translated_to')
      .single();
    if (error) setErr(error.message);
    else {
      setText(''); setPriority(false);
      if (data) setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
    }
    setSending(false);
  };

  // Ett meddelande som kräver åtgärd ska bli ett ärende, inte skrollas bort
  const toTask = async (m: Msg) => {
    setErr('');
    const { data, error } = await supabase.from('tasks')
      .insert({ title: m.body.slice(0, 120), description: m.body, created_by: userId })
      .select('id').single();
    if (error) { setErr(error.message); return; }
    await supabase.from('messages').update({ task_id: data.id }).eq('id', m.id);
    load();
  };

  const translate = async (m: Msg) => {
    setErr('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          question: `Översätt till svenska, svara med enbart översättningen: "${m.body}"`
        })
      });
      const body = await res.json();
      if (!res.ok) { setErr(body.error || 'Översättning misslyckades'); return; }
      await supabase.from('messages')
        .update({ translated_body: body.body ?? '', translated_to: 'sv' })
        .eq('id', m.id);
      load();
    } catch {
      setErr('Översättning misslyckades');
    }
  };

  const startDm = async (other: Person) => {
    setErr('');
    const { data, error } = await supabase.from('channels').insert({
      kind: 'direkt', name: other.full_name || 'Direkt', is_open: false, created_by: userId
    }).select('id').single();
    if (error) { setErr(error.message); return; }
    const { error: e2 } = await supabase.from('channel_members').insert([
      { channel_id: data.id, user_id: userId },
      { channel_id: data.id, user_id: other.id }
    ]);
    if (e2) { setErr(e2.message); return; }
    setNewDm(false);
    await loadChannels();
    setActive(data.id);
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const current = channels.find((c) => c.id === active);

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title">{tr('chat')}</h1>
          <div className="page-sub" style={{ marginBottom: 0 }}>{tn.name}</div>
        </div>
        <button className="btn btn-sm" onClick={() => setNewDm(true)}>
          <Plus size={14} /> Direktmeddelande
        </button>
      </div>

      <div className="chips" style={{ marginTop: 12 }}>
        {channels.map((c) => (
          <button key={c.id} className={`chip ${active === c.id ? 'active' : ''}`}
            onClick={() => setActive(c.id)}>
            {c.name || KIND_LABEL[c.kind]}
            {c.kind === 'direkt' && <span className="li-meta" style={{ marginTop: 0 }}> · direkt</span>}
          </button>
        ))}
        {channels.length === 0 && <div className="page-sub">Inga kanaler än.</div>}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="chat-box">
        <div className="chat-msgs">
          {msgs.map((m) => (
            <div key={m.id} className={`chat-msg ${m.sender === userId ? 'mine' : ''}`}>
              <div className="chat-bubble" style={m.priority ? {
                borderLeft: '3px solid var(--danger)', fontWeight: 600
              } : undefined}>
                {m.priority && <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}
                {m.body}
                {m.translated_body && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)', fontWeight: 400 }}>
                    {m.translated_body}
                  </div>
                )}
              </div>
              <div className="chat-meta">
                {m.sender === userId ? '' : `${names[m.sender] ?? '—'} · `}{fmt(m.created_at)}
                {m.task_id && ' · ärende skapat'}
                {' '}
                {!m.task_id && tier >= 2 && (
                  <button className="btn btn-sm" style={{ padding: '1px 6px', fontSize: 11 }}
                    onClick={() => toTask(m)}>
                    <ListPlus size={11} /> ärende
                  </button>
                )}
                {' '}
                {!m.translated_body && (
                  <button className="btn btn-sm" style={{ padding: '1px 6px', fontSize: 11 }}
                    onClick={() => translate(m)}>
                    <Languages size={11} /> översätt
                  </button>
                )}
              </div>
            </div>
          ))}
          {msgs.length === 0 && <div className="page-sub" style={{ marginBottom: 0 }}>{tr('nothingHere')}</div>}
          <div ref={endRef} />
        </div>

        {tier >= 4 && current && (
          <label className="check-row" style={{ margin: '0 0 6px' }}>
            <input type="checkbox" checked={priority} onChange={() => setPriority(!priority)} />
            Prioriterat driftmeddelande
          </label>
        )}

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
          <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim() || !active}>
            <Send size={16} /> <span className="send-label">{tr('send')}</span>
          </button>
        </div>
      </div>

      {newDm && (
        <div className="modal-overlay" onClick={() => setNewDm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="row-between">
              <h3 style={{ margin: 0 }}>Nytt direktmeddelande</h3>
              <button className="btn btn-sm" onClick={() => setNewDm(false)}><X size={14} /></button>
            </div>
            <div className="page-sub">
              Bara ni två kan läsa samtalet, oavsett vilken roll någon har.
            </div>
            <div className="list" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {people.map((p) => (
                <button key={p.id} className="list-item" style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '10px 0'
                }} onClick={() => startDm(p)}>
                  {p.full_name || '—'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
