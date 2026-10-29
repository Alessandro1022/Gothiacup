'use client';
// Boenden: skolor och hotell i samma vy. Hotell är en boendetyp, inte en
// egen modul, så nattrondering, felanmälan, incidenter och beläggning
// gäller dem utan att något av det byggts om.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, School, Tent, BedDouble, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { useTenant } from '@/components/TenantProvider';

type Kind = 'skola' | 'hotell' | 'vandrarhem' | 'camping';

// Databasen räknar beläggningen. Klienten hämtar en rad per boende.
type Stat = {
  id: string; name: string; address: string | null; capacity: number; area_id: string | null;
  kind: Kind; contact_name: string | null; contact_phone: string | null; rooms: number | null;
  in_house: number; teams_in: number; teams_expected: number;
  open_issues: number; open_incidents: number;
};
type Area = { id: string; name: string };

const KIND_LABEL: Record<Kind, string> = {
  skola: 'Skola', hotell: 'Hotell', vandrarhem: 'Vandrarhem', camping: 'Camping'
};

const KindIcon = ({ kind, size = 15 }: { kind: Kind; size?: number }) => {
  if (kind === 'hotell') return <Building2 size={size} />;
  if (kind === 'vandrarhem') return <BedDouble size={size} />;
  if (kind === 'camping') return <Tent size={size} />;
  return <School size={size} />;
};

export default function SchoolsClient() {
  const { tr } = useLang();
  const tn = useTenant();
  const supabase = createClient();
  const [rows, setRows] = useState<Stat[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [s, a] = await Promise.all([
        supabase.from('school_stats').select('*').order('name'),
        supabase.from('areas').select('id,name').order('name')
      ]);
      setRows((s.data ?? []) as Stat[]);
      setAreas((a.data ?? []) as Area[]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? '—';

  // Visa bara de typer som faktiskt finns, så filtret inte blir tomt brus
  const kinds = useMemo(() => {
    const seen = new Set<Kind>();
    rows.forEach((r) => seen.add(r.kind ?? 'skola'));
    return (['skola', 'hotell', 'vandrarhem', 'camping'] as Kind[]).filter((k) => seen.has(k));
  }, [rows]);

  const visible = useMemo(
    () => rows.filter((s) =>
      (area === '' || s.area_id === area) &&
      (kind === '' || (s.kind ?? 'skola') === kind) &&
      (q === '' || s.name.toLowerCase().includes(q.toLowerCase()))
    ),
    [rows, q, area, kind]
  );

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  return (
    <>
      <h1 className="page-title">{tn.labels.schools}</h1>
      <div className="page-sub">skolor och hotell · incheckning · nycklar · nattrond</div>

      <input className="input" style={{ marginBottom: 10 }} placeholder={tr('searchLbl')}
        value={q} onChange={(e) => setQ(e.target.value)} />

      {kinds.length > 1 && (
        <div className="chips">
          <button className={`chip ${kind === '' ? 'active' : ''}`} onClick={() => setKind('')}>
            {tr('all')}
          </button>
          {kinds.map((k) => (
            <button key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
              <KindIcon kind={k} size={13} /> {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      <div className="chips">
        <button className={`chip ${area === '' ? 'active' : ''}`} onClick={() => setArea('')}>{tr('all')}</button>
        {areas.map((a) => (
          <button key={a.id} className={`chip ${area === a.id ? 'active' : ''}`} onClick={() => setArea(a.id)}>
            {a.name}
          </button>
        ))}
      </div>

      <div className="grid-cards">
        {visible.map((s) => {
          const k = (s.kind ?? 'skola') as Kind;
          const pct = s.capacity > 0 ? Math.min(100, Math.round((s.in_house / s.capacity) * 100)) : 0;
          return (
            <Link key={s.id} href={`/schools/${s.id}`} className="card link-card">
              <div className="li-head">
                <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <KindIcon kind={k} /> {s.name}
                </div>
                {s.open_incidents > 0 && <span className="badge b-critical">{s.open_incidents}</span>}
              </div>
              <div className="li-meta">
                {KIND_LABEL[k]} · {areaName(s.area_id)}{s.address ? ` · ${s.address}` : ''}
              </div>

              <div className="stat-row" style={{ marginTop: 8 }}>
                <span>{tr('capacity')}</span>
                <b>{s.in_house}/{s.capacity} · {pct}%</b>
              </div>
              <div className="prog" style={{ marginBottom: 8 }}><div style={{ width: `${pct}%` }} /></div>

              {s.rooms ? (
                <div className="stat-row"><span>Rum</span><b>{s.rooms}</b></div>
              ) : null}
              <div className="stat-row"><span>{tr('teamsIn')}</span><b>{s.teams_in}</b></div>
              {s.teams_expected > 0 && (
                <div className="stat-row"><span>{tr('tmExpected')}</span><b>{s.teams_expected}</b></div>
              )}
              {s.open_issues > 0 && (
                <div className="stat-row"><span>{tr('openIssues')}</span><b>{s.open_issues}</b></div>
              )}

              {/* Säkerhetsgruppen ronderar hotell och behöver nå någon på plats */}
              {s.contact_phone ? (
                <div className="li-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Phone size={13} /> {s.contact_name || 'Kontakt'} · {s.contact_phone}
                </div>
              ) : null}
            </Link>
          );
        })}
        {visible.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
      </div>
    </>
  );
}
