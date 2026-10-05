'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, LayoutDashboard, AlertTriangle, CheckSquare, LogOut,
  Map, School, Landmark, CalendarClock, Users, BarChart3,
  Newspaper, MessageSquare, FileText, Siren, Settings2, Sparkles, History,
  Layers, Building2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { useTenant } from '@/components/TenantProvider';
import type { FeatureKey } from '@/lib/features';
import { tierOf, type Role, ROLE_LABELS } from '@/lib/types';
import { LANGS, type Lang } from '@/lib/i18n';

type Props = { role: Role; name: string; children: React.ReactNode };

export default function Shell({ role, name, children }: Props) {
  const { lang, setLang, tr } = useLang();
  const tn = useTenant();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState('--:--');
  const [openInc, setOpenInc] = useState<number | null>(null);
  const [staffPct, setStaffPct] = useState<number | null>(null);
  const [crisis, setCrisis] = useState<{ active: boolean; message: string | null }>({ active: false, message: null });
  const supabase = createClient();
  const tier = tierOf(role);

  // Klocka (minutupplösning räcker – billigare än sekundtick)
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  // Telemetri + krisläge + runtime-inställningar, live
  useEffect(() => {
    const loadCounts = async () => {
      const nowIso = new Date().toISOString();
      const [inc, act, chk] = await Promise.all([
        supabase.from('incidents').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).lte('starts_at', nowIso).gte('ends_at', nowIso),
        supabase.from('shifts').select('id', { count: 'exact', head: true }).lte('starts_at', nowIso).gte('ends_at', nowIso).eq('status', 'checked_in')
      ]);
      setOpenInc(inc.count ?? 0);
      setStaffPct(act.count ? Math.round(((chk.count ?? 0) / act.count) * 100) : null);
    };
    const loadCrisis = async () => {
      // Ingen id-filtrering längre: krisläget är en rad per turnering och
      // RLS ger bara den inloggades egen.
      const { data } = await supabase.from('crisis_state').select('active,message').maybeSingle();
      if (data) setCrisis(data);
    };
    loadCounts(); loadCrisis();
    const ch = supabase
      .channel('shell-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crisis_state' }, loadCrisis)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brandName = tn.name;

  const nav = [
    {
      label: tr('gOverview'),
      items: [
        { href: '/dashboard', label: tr('dashboard'), Icon: LayoutDashboard, minTier: 1 },
        { href: '/reports', label: tr('reports'), Icon: BarChart3, minTier: 3 },
        { href: '/ai', label: tr('aiTitle'), Icon: Sparkles, minTier: 2 }
      ]
    },
    {
      label: tr('gOps'),
      items: [
        { href: '/incidents', label: tr('incidents'), Icon: AlertTriangle, minTier: 1 },
        { href: '/tasks', label: tr('tasks'), Icon: CheckSquare, minTier: 1 },
        { href: '/shifts', label: tr('shifts'), Icon: CalendarClock, minTier: 1 }
      ]
    },
    {
      label: tr('gArea'),
      items: [
        { href: '/areas', label: tn.labels.areas, Icon: Map, minTier: 3 },
        { href: '/schools', label: tn.labels.schools, Icon: School, minTier: 2 },
        { href: '/arenas', label: tn.labels.playingAreas, Icon: Landmark, minTier: 2 },
        { href: '/map', label: 'Karta', Icon: Map, minTier: 2 }
      ]
    },
    {
      label: tr('gComms'),
      items: [
        { href: '/news', label: tr('news'), Icon: Newspaper, minTier: 1 },
        { href: '/chat', label: tr('chat'), Icon: MessageSquare, minTier: 1 },
        { href: '/docs', label: tr('docs'), Icon: FileText, minTier: 1 }
      ]
    },
    {
      label: tr('gMgmt'),
      items: [
        { href: '/staff', label: tr('staff'), Icon: Users, minTier: 4 },
        { href: '/history', label: tr('history'), Icon: History, minTier: 4 },
        { href: '/crisis', label: tr('crisis'), Icon: Siren, minTier: 5 },
        { href: '/settings', label: tr('settings'), Icon: Settings2, minTier: 5 },
        { href: '/structure', label: 'Struktur', Icon: Building2, minTier: 5 },
        { href: '/platform', label: 'Plattform', Icon: Layers, minTier: 6 }
      ]
    }
  ];

  const closeDrawer = () => setOpen(false);
  const bottomItems = [
    { href: '/dashboard', label: tr('dashboard'), Icon: LayoutDashboard },
    { href: '/incidents', label: tr('incidents'), Icon: AlertTriangle },
    { href: '/shifts', label: tr('shifts'), Icon: CalendarClock },
    { href: '/chat', label: tr('chat'), Icon: MessageSquare }
  ];

  return (
    <div className="shell">
      {crisis.active && (
        <div className="crisis-banner" style={{ position: 'fixed', left: 0, right: 0, top: 0 }}>
          <Siren size={16} /> {tr('crisisActive')}{crisis.message ? ` — ${crisis.message}` : ''}
        </div>
      )}

      <div className="topbar" style={crisis.active ? { top: 40 } : undefined}>
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Meny">
          <Menu size={22} />
        </button>
        <div className="brand-name">{brandName}</div>
        <div className="mono" style={{ marginLeft: 'auto', fontSize: 13 }}>
          <span className="pulse" />{clock}
        </div>
      </div>

      <div className={`overlay ${open ? 'show' : ''}`} onClick={closeDrawer} />

      <aside className={`sidebar ${open ? 'open' : ''}`} style={crisis.active ? { top: 40 } : undefined}>
        <div className="brand">
          <div className="brand-badge">{tn.logoText}</div>
          <div>
            <div className="brand-name">{brandName}</div>
            <div className="brand-sub">TOURNAMENTOPS · {tn.sport.toUpperCase()}</div>
          </div>
        </div>

        <div className="spine">
          <div className="spine-item">
            <div className={`spine-num ${openInc && openInc > 0 ? 'warn' : ''}`}>{openInc ?? '–'}</div>
            <div className="spine-lbl">{tr('incidents')}</div>
          </div>
          <div className="spine-item">
            <div className="spine-num">{staffPct === null ? '–' : `${staffPct}%`}</div>
            <div className="spine-lbl">{tr('staffing')}</div>
          </div>
          <div className="spine-item">
            <div className="spine-num">{clock}</div>
            <div className="spine-lbl">{tn.city}</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((g) => {
            const items = g.items.filter(
              (i) => tier >= i.minTier && tn.has(i.href.slice(1) as FeatureKey)
            );
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <div className="nav-label">{g.label}</div>
                {items.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} onClick={closeDrawer}
                    className={`nav-link ${pathname.startsWith(href) ? 'active' : ''}`}>
                    <Icon size={17} /> {label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="user-line">{name || '—'} · {ROLE_LABELS[role]}</div>
          <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          <form action="/auth/signout" method="post">
            <button className="nav-link" style={{ width: '100%', border: 'none', background: 'none' }}>
              <LogOut size={17} /> {tr('logout')}
            </button>
          </form>
        </div>
      </aside>

      <main className="main" style={crisis.active ? { paddingTop: 56 } : undefined}>{children}</main>

      <nav className="bottombar">
        {bottomItems.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={pathname.startsWith(href) ? 'active' : ''}>
            <Icon size={19} /> {label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)}><Menu size={19} /> {tr('more')}</button>
      </nav>
    </div>
  );
}
