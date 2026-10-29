// Modulspärr på serversidan.
//
// Shell.tsx döljer menyposten för en avstängd modul, men det är kosmetika:
// skriver man adressen för hand laddar sidan ändå. När moduler är det man
// betalar för duger inte det, så varje modulsida kallar assertModule().
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { FeatureKey } from '@/lib/features';

type TenantFeatures = { features?: Record<string, boolean> | null } | null;

export async function moduleEnabled(key: FeatureKey): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Två oberoende frågor måste båda svara ja: ingår modulen i
    // turneringens paket, och når den inloggades roll den?
    // Den första är vad kunden betalat för, den andra vad personen jobbar
    // med. En matansvarig ska inte se ekonomi även om turneringen har den.
    const [tenant, role] = await Promise.all([
      supabase.rpc('my_tenant_row').maybeSingle(),
      supabase.rpc('can_module', { key, need_write: false })
        .then((r) => r, () => ({ data: null }))
    ]);

    // null = funktionen finns inte ännu (del 12b inte körd): låt det passera
    if (role?.data === false) return false;

    const features = (tenant.data as TenantFeatures)?.features;

    // Ingen turnering satt, tabellen saknas, eller tom uppsättning:
    // blockera inte. Medvetet val – ett databasfel ska inte låsa ute en
    // betalande kund, och menyn döljer modulen ändå.
    if (!features || Object.keys(features).length === 0) return true;

    // En modul är PÅ bara om den uttryckligen står som true. Tidigare
    // räknades en omämnd nyckel som på, och då hade varje ny modul blivit
    // gratis för alla befintliga kunder tills den stängdes av för hand.
    // Del 9 ser till att varje turnering har en komplett uppsättning.
    return features[key] === true;
  } catch {
    return true;
  }
}

// Skickar till /locked i stället för /dashboard, så att användaren får veta
// varför sidan inte går att öppna i stället för att tyst hamna någon annanstans.
export async function assertModule(key: FeatureKey): Promise<void> {
  if (!(await moduleEnabled(key))) redirect(`/locked?m=${key}`);
}
