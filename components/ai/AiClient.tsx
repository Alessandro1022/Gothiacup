'use client';
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Car } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role } from '@/lib/types';
import { tenant } from '@/lib/tenant';

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
      supabase.from('ai_reports').select('id,kind,slot,report_date,body,created_at').order('created_at', { ascending: false }).limit(40),
      supabase.from('car_routes').select('id,car_id,slot,route_date,stops').order('created_at', { ascending: false }).limit(12),
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
    if (!question) return;
    setAsking(true); setAnswer('');
    const res = await fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ask', question })
    });
    const data = await res.json();
    setAnswer(res.ok ? data.body : (data.error ?? 'Fel'));
    setAsking(false);
  };

  const kindLabel = (k: string) =>
    k === 'overview' ? tr('aiOverview') : k === 'schools' ? tenant.labels.schools : k === 'security' ? tr('aiSecurity') : tr('matchesLbl');
  const slotLabel = (s: string) => s === 'morning' ? tr('aiMorning') : s === 'evening' ? tr('aiEvening') : tr('aiManual');

  return (
    <>
      <div className="row-between">
        <div>
          <h1 className="page-title"><Sparkles size={19} style={{ verticalAlign: -2, color: 'var(--accent)' }} /> {tr('aiTitle')}</h1>
          <div className="page-sub" style={{ marginBottom: 0 }}>{tr('aiSub')}</div>
        </div>
        {tier >= 3 && (
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {busy ? tr('aiWorking') : tr('generate')}
          </button>
        )}
      </div>

      <div className="chips" style={{ marginTop: 12 }}>
        {KINDS.map((k) => (
          <button key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{kindLabel(k)}</button>
        ))}
      </div>
      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      {/* Säkerhetsrutter */}
      {kind === 'security' && currentRoutes.length > 0 && (
        <div className="grid-cards" style={{ marginBottom: 14 }}>
          {currentRoutes.map((r) => {
            const car = cars.find((c) => c.id === r.car_id);
            return (
              <div key={r.id} className="card">
                <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Car size={16} style={{ color: 'var(--primary)' }} /> {car?.label ?? '—'}
                  <span className="badge b-low" style={{ marginLeft: 'auto' }}>{slotLabel(r.slot)}</span>
                </div>
                {r.stops.map((s, i) => (
                  <div key={s.school_id} style={{ padding: '7px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{i + 1}. {s.name}</div>
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
      {current ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="li-meta mono" style={{ marginBottom: 10 }}>
            {slotLabel(current.slot)} · {current.report_date} · {new Date(current.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.55 }}>{current.body}</div>
        </div>
      ) : (
        <div className="page-sub">{tr('aiNoReport')}</div>
      )}

      {/* Fråga AI */}
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{tr('askAi')}</h2>
      <div className="chat-input" style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--panel)', marginBottom: 10 }}>
        <input className="input" placeholder={tr('askPlaceholder')} value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(); }} />
        <button className="btn btn-primary" onClick={ask} disabled={asking}>{asking ? '…' : tr('send')}</button>
      </div>
      {answer && <div className="card" style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.55 }}>{answer}</div>}
    </>
  );
}
