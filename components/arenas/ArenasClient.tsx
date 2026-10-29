'use client';
// Spelplatser, domarregister med domarschema, och tabeller.
//
// Tabellen räknas i databasen (group_standings), inte här: samma siffror
// ska gälla oavsett vem som tittar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Phone, Plus, Pencil, Trash2, Trophy, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { useTenant } from '@/components/TenantProvider';

export type ArenasTab = 'platser' | 'domare' | 'tabeller';

type Arena = { id: string; name: string; address: string | null; surface_count: number; area_id: string | null };
type Area = { id: string; name: string };
type Match = {
  id: string; arena_id: string; status: string; starts_at: string;
  home_team: string; away_team: string; referee_id: string | null; referee_2_id: string | null;
};
type Referee = {
  id: string; full_name: string; phone: string; email: string; level: string;
  languages: string; active: boolean; notes: string;
};
type Standing = {
  group_name: string; category: string | null; team: string; played: number; won: number;
  drawn: number; lost: number; goals_for: number; goals_against: number; goal_diff: number; points: number;
};

// En match tar ungefär så här lång tid inklusive byte; tätare än så är en krock
const CLASH_MIN = 75;

export default function ArenasClient({ canManage, initialTab = 'platser' }: {
  canManage: boolean; initialTab?: ArenasTab;
}) {
  const { tr } = useLang();
  const tenant = useTenant();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<ArenasTab>(initialTab);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Domarformulär
  const [editId, setEditId] = useState<string | null>(null);
  const [rName, setRName] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rLevel, setRLevel] = useState('');
  const [rLang, setRLang] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  // Formuläret är ihopfällt så att listan syns först på telefonen
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const [a, ar, m, r, s] = await Promise.all([
      supabase.from('arenas').select('id,name,address,surface_count,area_id').order('name'),
      supabase.from('areas').select('id,name'),
      supabase.from('arena_matches').select('id,arena_id,status,starts_at,home_team,away_team,referee_id,referee_2_id').order('starts_at'),
      supabase.from('referees').select('*').order('full_name'),
      supabase.from('group_standings').select('*')
    ]);
    setArenas((a.data ?? []) as Arena[]);
    setAreas((ar.data ?? []) as Area[]);
    setMatches((m.data ?? []) as Match[]);
    setReferees((r.data ?? []) as Referee[]);
    setStandings((s.data ?? []) as Standing[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const resetRef = () => {
    setShowForm(false);
    setEditId(null); setRName(''); setRPhone(''); setREmail(''); setRLevel(''); setRLang('');
  };

  const editRef = (r: Referee) => {
    setShowForm(true);
    setEditId(r.id); setRName(r.full_name); setRPhone(r.phone); setREmail(r.email);
    setRLevel(r.level); setRLang(r.languages);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveRef = async () => {
    setErr('');
    if (!rName.trim()) return;
    const payload = {
      full_name: rName.trim(), phone: rPhone.trim(), email: rEmail.trim(),
      level: rLevel.trim(), languages: rLang.trim()
    };
    const { error } = editId
      ? await supabase.from('referees').update(payload).eq('id', editId)
      : await supabase.from('referees').insert(payload);
    if (error) { setErr(error.message); return; }
    resetRef(); load();
  };

  const toggleActive = async (r: Referee) => {
    const { error } = await supabase.from('referees').update({ active: !r.active }).eq('id', r.id);
    if (error) setErr(error.message);
    load();
  };

  const removeRef = async (r: Referee) => {
    if (!confirm(`Ta bort ${r.full_name}? Matcherna blir utan domare.`)) return;
    const { error } = await supabase.from('referees').delete().eq('id', r.id);
    if (error) setErr(error.message);
    load();
  };

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? '—';
  const arenaName = (id: string) => arenas.find((a) => a.id === id)?.name ?? '—';
  const fmt = (d: string) => new Date(d).toLocaleString('sv-SE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // Domarschema: kommande matcher per domare, med krockar markerade
  const schedule = useMemo(() => {
    const since = Date.now() - 2 * 3600e3;
    const out = new Map<string, { m: Match; clash: boolean }[]>();
    for (const r of referees) {
      const list = matches
        .filter((m) => (m.referee_id === r.id || m.referee_2_id === r.id)
          && m.status !== 'cancelled' && new Date(m.starts_at).getTime() >= since)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      out.set(r.id, list.map((m, i) => {
        const t = new Date(m.starts_at).getTime();
        const near = (x?: Match) => !!x && Math.abs(new Date(x.starts_at).getTime() - t) < CLASH_MIN * 60e3;
        return { m, clash: near(list[i - 1]) || near(list[i + 1]) };
      }));
    }
    return out;
  }, [referees, matches]);

  // Tabeller per klass och grupp, sorterade på poäng, målskillnad, gjorda mål
  const groups = useMemo(() => {
    const m = new Map<string, Standing[]>();
    for (const s of standings) {
      const k = `${s.category ?? ''}|${s.group_name}`;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'sv'))
      .map(([k, rows]) => ({
        key: k,
        title: [rows[0].category, rows[0].group_name].filter(Boolean).join(' · '),
        rows: [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff
          || b.goals_for - a.goals_for || a.team.localeCompare(b.team, 'sv'))
      }));
  }, [standings]);

  if (loading) return <div className="page-sub">{tr('loading')}</div>;

  const shownRefs = referees.filter((r) => r.active || showInactive);
  const clashes = [...schedule.values()].flat().filter((x) => x.clash).length;

  return (
    <>
      <h1 className="page-title">{tenant.labels.playingAreas}</h1>
      <div className="page-sub">matcher · domare · tabeller · säkerhet · checklistor</div>

      {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'platser' ? 'active' : ''}`} onClick={() => setTab('platser')}>
          {tenant.labels.playingAreas} <span className="mono">{arenas.length}</span>
        </button>
        <button className={`tab ${tab === 'domare' ? 'active' : ''}`} onClick={() => setTab('domare')}>
          Domare <span className="mono">{referees.filter((r) => r.active).length}</span>
        </button>
        <button className={`tab ${tab === 'tabeller' ? 'active' : ''}`} onClick={() => setTab('tabeller')}>
          Tabeller <span className="mono">{groups.length}</span>
        </button>
      </div>

      {tab === 'platser' && (
        <div className="grid-cards">
          {arenas.map((a) => {
            const live = matches.filter((m) => m.arena_id === a.id && m.status === 'ongoing').length;
            const upcoming = matches.filter((m) => m.arena_id === a.id && m.status === 'scheduled').length;
            return (
              <Link key={a.id} href={`/arenas/${a.id}`} className="card link-card">
                <div className="li-head">
                  <div className="li-title">{a.name}</div>
                  {live > 0 && <span className="badge b-ongoing"><span className="pulse" />{live} {tr('live')}</span>}
                </div>
                <div className="li-meta">{areaName(a.area_id)}{a.address ? ` · ${a.address}` : ''}</div>
                <div className="stat-row">
                  <div className="stat"><div className="num">{a.surface_count}</div><div className="lbl">{tenant.labels.playingAreas}</div></div>
                  <div className="stat"><div className="num">{upcoming}</div><div className="lbl">{tr('matchesLbl')}</div></div>
                </div>
              </Link>
            );
          })}
          {arenas.length === 0 && <div className="page-sub">{tr('nothingHere')}</div>}
        </div>
      )}

      {tab === 'domare' && (
        <>
          {canManage && !showForm && (
            <button className="btn btn-primary" style={{ marginBottom: 14 }} onClick={() => setShowForm(true)}>
              <Plus size={15} /> Ny domare
            </button>
          )}
          {canManage && showForm && (
            <div className="inline-form cols">
              <div style={{ flex: 2 }}><label className="label">Namn</label>
                <input className="input" value={rName} onChange={(e) => setRName(e.target.value)} /></div>
              <div><label className="label">Telefon</label>
                <input className="input" type="tel" value={rPhone} onChange={(e) => setRPhone(e.target.value)} /></div>
              <div><label className="label">E-post</label>
                <input className="input" type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)} /></div>
              <div><label className="label">Nivå</label>
                <input className="input" value={rLevel} onChange={(e) => setRLevel(e.target.value)} placeholder="t.ex. distriktsdomare" /></div>
              <div><label className="label">Språk</label>
                <input className="input" value={rLang} onChange={(e) => setRLang(e.target.value)} placeholder="t.ex. svenska, engelska" /></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary" onClick={saveRef} disabled={!rName.trim()}>
                  {editId ? 'Spara' : <><Plus size={15} /> Lägg till</>}
                </button>
                <button className="btn" onClick={resetRef}>Avbryt</button>
              </div>
            </div>
          )}

          {clashes > 0 && (
            <div className="form-error" style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <TriangleAlert size={15} /> Minst en domare har matcher för tätt inpå varandra.
            </div>
          )}

          <div className="list">
            {shownRefs.map((r) => {
              const list = schedule.get(r.id) ?? [];
              return (
                <div key={r.id} className="list-item" style={!r.active ? { opacity: 0.6 } : undefined}>
                  <div className="li-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="li-title">{r.full_name}{!r.active && ' · inaktiv'}</div>
                      <div className="li-meta">
                        {[r.level, r.languages].filter(Boolean).join(' · ') || 'Ingen nivå angiven'}
                      </div>
                    </div>
                    <span className={`badge ${list.some((x) => x.clash) ? 'b-critical' : 'b-low'}`}>
                      {list.length} {list.length === 1 ? 'match' : 'matcher'}
                    </span>
                  </div>

                  {list.length > 0 && (
                    <div className="ref-schedule">
                      {list.map(({ m, clash }) => (
                        <div key={m.id} className={`ref-match ${clash ? 'clash' : ''}`}>
                          <span className="mono">{fmt(m.starts_at)}</span>
                          <span>{m.home_team} – {m.away_team} · {arenaName(m.arena_id)}</span>
                          {clash && <b>krock</b>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="li-actions">
                    {r.phone && <a className="btn btn-sm" href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}><Phone size={13} /> {r.phone}</a>}
                    {canManage && (
                      <>
                        <button className="btn btn-sm" onClick={() => editRef(r)}><Pencil size={13} /> Ändra</button>
                        <button className="btn btn-sm" onClick={() => toggleActive(r)}>{r.active ? 'Inaktivera' : 'Aktivera'}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => removeRef(r)} aria-label="Ta bort"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {referees.length === 0 && (
              <div className="page-sub">
                Inga domare registrerade.{canManage && ' Lägg till dem här, så går de att sätta på matcherna.'}
              </div>
            )}
          </div>
          {referees.some((r) => !r.active) && (
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? 'Dölj inaktiva' : 'Visa inaktiva'}
            </button>
          )}
        </>
      )}

      {tab === 'tabeller' && (
        <>
          {groups.map((g) => (
            <div key={g.key} className="card" style={{ marginBottom: 12, padding: '12px 10px' }}>
              <div className="li-title" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 4px 8px' }}>
                <Trophy size={15} /> {g.title}
              </div>
              <table className="standings">
                <thead>
                  <tr><th className="team">Lag</th><th>M</th><th>V</th><th>O</th><th>F</th><th>Mål</th><th>+/-</th><th>P</th></tr>
                </thead>
                <tbody>
                  {g.rows.map((s, i) => (
                    <tr key={s.team}>
                      <td className="team"><span className="pos">{i + 1}</span>{s.team}</td>
                      <td>{s.played}</td><td>{s.won}</td><td>{s.drawn}</td><td>{s.lost}</td>
                      <td className="mono">{s.goals_for}–{s.goals_against}</td>
                      <td className="mono">{s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}</td>
                      <td><b>{s.points}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="page-sub">
              Inga tabeller än. En match räknas när den har en grupp och ett resultat,
              eller walkover, och är markerad som spelad.
            </div>
          )}
          {groups.length > 0 && (
            <div className="li-meta">3 poäng för vinst, 1 för oavgjort. Walkover räknas som 3–0.</div>
          )}
        </>
      )}
    </>
  );
}
