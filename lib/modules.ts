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
    const { data } = await supabase.rpc('my_tenant_row').maybeSingle();
    const features = (data as TenantFeatures)?.features;

    // Ingen turnering satt, eller tabellen saknas ännu: blockera inte.
    // Medvetet val – ett databasfel ska inte låsa ute en betalande kund.
    // Menyn döljer modulen ändå, så exponeringen är liten.
    if (!features) return true;

    // En modul som inte nämns i paketet räknas som på. Avstängda moduler
    // sätts uttryckligen till false av paketen i del 8.
    return features[key] !== false;
  } catch {
    return true;
  }
}

// Skickar till /locked i stället för /dashboard, så att användaren får veta
// varför sidan inte går att öppna i stället för att tyst hamna någon annanstans.
export async function assertModule(key: FeatureKey): Promise<void> {
  if (!(await moduleEnabled(key))) redirect(`/locked?m=${key}`);
}
