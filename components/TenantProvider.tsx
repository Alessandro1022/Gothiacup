'use client';
// Läser aktiv turnering ur databasen och applicerar namn, färger och moduler
// i realtid. Faller tillbaka på lib/tenant.ts om tabellen saknas.
// event_settings läggs på sist som finjustering ovanpå turneringens tema.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { tenant as fallback } from '@/lib/tenant';
import type { FeatureKey, TenantRow } from '@/lib/features';

type Ctx = {
  active: TenantRow | null;
  name: string;
  shortName: string;
  sport: string;
  city: string;
  logoText: string;
  logoUrl: string | null;
  labels: {
    playingArea: string; playingAreas: string; matchStart: string;
    school: string; schools: string; area: string; areas: string;
  };
  has: (f: FeatureKey) => boolean;
  reload: () => void;
};

const fallbackCtx = (): Ctx => ({
  active: null,
  name: fallback.event.name,
  shortName: fallback.event.shortName,
  sport: fallback.event.sport,
  city: fallback.event.city,
  logoText: fallback.event.logoText,
  logoUrl: null,
  labels: {
    playingArea: fallback.labels.playingArea,
    playingAreas: fallback.labels.playingAreas,
    matchStart: fallback.labels.matchStart,
    school: fallback.labels.school,
    schools: fallback.labels.schools,
    area: fallback.labels.area,
    areas: fallback.labels.areas
  },
  has: () => true,
  reload: () => {}
});

const TenantCtx = createContext<Ctx | null>(null);

// Fungerar även utan provider – då gäller den statiska konfigurationen
export function useTenant(): Ctx {
  return useContext(TenantCtx) ?? fallbackCtx();
}

const isHex = (v?: string | null) => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

export default function TenantProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [row, setRow] = useState<TenantRow | null>(null);

  const load = useCallback(async () => {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('tenants').select('*').eq('active', true).limit(1).maybeSingle(),
      supabase.from('event_settings').select('event_name,primary_color').eq('id', 1).maybeSingle()
    ]);

    const active = (t ?? null) as TenantRow | null;
    setRow(
      active && s?.event_name
        ? { ...active, name: s.event_name }
        : active
    );

    // Färger: turneringens tema först, event_settings som override
    const root = document.documentElement;
    const set = (k: string, v?: string | null) => {
      if (isHex(v)) root.style.setProperty(k, v as string);
      else root.style.removeProperty(k);
    };
    const c = active?.colors ?? {};
    set('--primary', c.primary);
    set('--primary-dark', c.primaryDark);
    set('--panel-2', c.panel2);
    set('--accent', c.accent);
    set('--bg', c.bg);

    if (isHex(s?.primary_color)) {
      root.style.setProperty('--primary', s!.primary_color as string);
      root.style.setProperty('--primary-dark', s!.primary_color as string);
    }

    const title = s?.event_name || active?.name;
    if (title) document.title = `${title} · TournamentOps`;
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('tenant-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_settings' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const base = fallbackCtx();
  const value: Ctx = {
    active: row,
    name: row?.name || base.name,
    shortName: row?.short_name || base.shortName,
    sport: row?.sport || base.sport,
    city: row?.city || base.city,
    logoText: row?.logo_text || base.logoText,
    logoUrl: row?.logo_url ?? null,
    labels: {
      playingArea: row?.labels?.playingArea || base.labels.playingArea,
      playingAreas: row?.labels?.playingAreas || base.labels.playingAreas,
      matchStart: row?.labels?.matchStart || base.labels.matchStart,
      school: row?.labels?.school || base.labels.school,
      schools: row?.labels?.schools || base.labels.schools,
      area: row?.labels?.area || base.labels.area,
      areas: row?.labels?.areas || base.labels.areas
    },
    has: (f) => (row ? row.features?.[f] !== false : true),
    reload: load
  };

  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>;
}
