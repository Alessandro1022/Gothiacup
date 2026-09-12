'use client';
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Car, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';
import { tenant } from '@/lib/tenant';
import Markdown from '@/components/ai/Markdown';

type Report = { id: string; kind: string; slot: string; report_date: string; body: string; created_at: string };
type Route = { id: string; car_id: string; slot: string; route_date: string; stops: { school_id: string; name: string; score: number; reasons: string[] }[] };
type CarRow = { id: string; label: string };

const KINDS = ['overview', 'schools', 'security', 'matches'] as const;

export default function AiClient({ role }: { role: Role }) {
  const { tr } = useLang();
  const supabase = createClient();
  const tier = tierOf(role);
  const [kind, setKind] = useState<string>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: rt }, { data: c }] = await Promise.all([
      supabase.from('ai_reports').select('id,kind,slot,report_date,body,created_at')
        .order('created_at', { ascending: false }).limit(40),
      supabase.from('car_routes').select('id,car_id,slot,route_date,stops')
        .order('created_at', { ascending: false }).limit(12),
      supabase.from('security_cars').select('id,label').order('label')
    ]);
    setReports((r ?? []) as Report[]);
    setRoutes((rt ?? []) as Route[]);
    setCars((c ?? []) as CarRow[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel('ai-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_reports' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'car_routes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const current = reports.find((r) => r.kind === kind);
  const latestDate = routes[0]?.route_date;
  const currentRoutes = routes.filter((r) => r.route_date === latestDate);

  const generate = async () => {
    setBusy(true); setErr('');
    const res = await fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report', kind, slot: 'manual' })
    });
    if (!res.ok) setErr((await res.json()).error ?? 'Fel');
    setBusy(false); load();
  };

  const ask = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setAsking(true); setAnswer(''); setErr('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ask', question })
      });
      const data = await res.json();
      if (res.ok) { setAnswer(data.body); setQ(''); }
      else setErr(data.error ?? 'Fel');
    } catch {
      setErr('Kunde inte nå AI:n');
    }
    setAsking(false);
  };

  const kindLabel = (k: string) =>
    k === 'overview' ? tr('aiOverview')
      : k === 'schools' ? tenant.labels.schools
        : k === 'security' ? tr('aiSecurity') : tr('matchesLbl');
  const slotLabel = (s: string) =>
    s === 'morning' ? tr('aiMorning') : s === 'evening' ? tr('aiEvening') : tr('aiManual');

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title">
            <Sparkles size={19} style={{ verticalAlign: -2, color: 'var(--accent)' }} /> {tr('aiTitle')}
          </h1>
          <div className="page-sub" style={{ marginBottom: 0 }}>{tr('aiSub')}</div>
        </div>
        {tier >= 3 && (
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            <RefreshCw size={15} className={busy ? 'spin' : undefined} />
            {busy ? tr('aiWorking') : tr('generate')}
          </button>
        )}
      </div>

      <div className="chips" style={{ marginTop: 14 }}>
        {KINDS.map((k) => (
          <button key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            {kindLabel(k)}
          </button>
        ))}
      </div>

      {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}

      {busy && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="skel" style={{ height: 14, width: '45%', marginBottom: 10 }} />
          <div className="skel" style={{ height: 12, marginBottom: 7 }} />
          <div className="skel" style={{ height: 12, marginBottom: 7 }} />
          <div className="skel" style={{ height: 12, width: '70%' }} />
        </div>
      )}

      {/* Säkerhetsrutter */}
      {kind === 'security' && currentRoutes.length > 0 && (
        <div className="grid-cards" style={{ marginBottom: 16 }}>
          {currentRoutes.map((r) => {
            const car = cars.find((c) => c.id === r.car_id);
            return (
              <div key={r.id} className="card">
                <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Car size={17} style={{ color: 'var(--primary)' }} /> {car?.label ?? '—'}
                  <span className="badge b-low" style={{ marginLeft: 'auto' }}>{slotLabel(r.slot)}</span>
                </div>
                {r.stops.map((s, i) => (
                  <div key={s.school_id} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{i + 1}. {s.name}</div>
                    {s.reasons.length > 0 && <div className="li-meta">{s.reasons.join(' · ')}</div>}
                  </div>
                ))}
                {r.stops.length === 0 && <div className="page-sub" style={{ marginBottom: 0 }}>{tr('nothingHere')}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Rapport */}
      {!busy && (current ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="li-meta mono" style={{ marginTop: 0, marginBottom: 12 }}>
            {slotLabel(current.slot)} · {current.report_date} ·{' '}
            {new Date(current.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <Markdown text={current.body} />
        </div>
      ) : (
        <div className="page-sub">{tr('aiNoReport')}</div>
      ))}

      {/* Fråga AI */}
      <h2 style={{ fontSize: 17, marginBottom: 10 }}>{tr('askAi')}</h2>
      <div className="chat-input" style={{
        border: '1px solid var(--line)', borderRadius: 16,
        background: 'var(--panel)', marginBottom: 12
      }}>
        <input
          className="input"
          style={{ minWidth: 0, flex: 1, border: 'none', boxShadow: 'none', background: 'transparent' }}
          placeholder={tr('askPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } }}
          enterKeyHint="send"
          disabled={asking}
        />
        <button className="btn btn-primary" onClick={ask} disabled={asking || !q.trim()}
          style={{ flex: '0 0 auto' }}>
          <Send size={16} /> <span className="send-label">{tr('send')}</span>
        </button>
      </div>

      {asking && (
        <div className="card">
          <div className="li-meta" style={{ marginTop: 0, marginBottom: 10 }}>{tr('aiWorking')}</div>
          <div className="skel" style={{ height: 12, marginBottom: 7 }} />
          <div className="skel" style={{ height: 12, marginBottom: 7 }} />
          <div className="skel" style={{ height: 12, width: '60%' }} />
        </div>
      )}

      {!asking && answer && (
        <div className="card"><Markdown text={answer} /></div>
      )}
    </>
  );
}
