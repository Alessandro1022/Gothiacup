'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LayoutDashboard, AlertTriangle, CheckSquare, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { tenant } from '@/lib/tenant';
import { useLang } from '@/components/LanguageProvider';
import { tierOf, type Role, ROLE_LABELS } from '@/lib/types';
import { LANGS, type Lang } from '@/lib/i18n';

type Props = { role: Role; name: string; children: React.ReactNode };

export default function Shell({ role, name, children }: Props) {
  const { lang, setLang, tr } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState('--:--:--');
  const [openInc, setOpenInc] = useState<number | null>(null);
  const supabase = createClient();
  const tier = tierOf(role);

  // Klocka
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('sv-SE'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Ops-spine: öppna incidenter live
  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'resolved');
      setOpenInc(count ?? 0);
    };
    load();
    const ch = supabase
      .channel('spine-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nav = [
    {
      label: tr('gOverview'),
      items: [{ href: '/dashboard', label: tr('dashboard'), Icon: LayoutDashboard, minTier: 1 }]
    },
    {
      label: tr('gOps'),
      items: [
        { href: '/incidents', label: tr('incidents'), Icon: AlertTriangle, minTier: 1 },
        { href: '/tasks', label: tr('tasks'), Icon: CheckSquare, minTier: 1 }
      ]
    }
  ];

  const closeDrawer = () => setOpen(false);

  return (
    <div className="shell">
      <div className="topbar">
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Meny">
          <Menu size={22} />
        </button>
        <div className="brand-name">{tenant.event.name}</div>
        <div className="mono" style={{ marginLeft: 'auto', fontSize: 13 }}>{clock}</div>
      </div>

      <div className={`overlay ${open ? 'show' : ''}`} onClick={closeDrawer} />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-badge">{tenant.event.logoText}</div>
          <div>
            <div className="brand-name">{tenant.event.name}</div>
            <div className="brand-sub">TournamentOps · {tenant.event.sport}</div>
          </div>
        </div>

        <div className="spine">
          <div className="spine-item">
            <div className={`spine-num ${openInc && openInc > 0 ? 'warn' : ''}`}>{openInc ?? '–'}</div>
            <div className="spine-lbl">{tr('incidents')}</div>
          </div>
          <div className="spine-item">
            <div className="spine-num">–</div>
            <div className="spine-lbl">{tr('staffing')}</div>
          </div>
          <div className="spine-item">
            <div className="spine-num">{clock.slice(0, 5)}</div>
            <div className="spine-lbl">{tenant.event.city}</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((g) => {
            const items = g.items.filter((i) => tier >= i.minTier);
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

      <main className="main">{children}</main>
    </div>
  );
}
