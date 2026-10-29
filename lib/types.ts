export type Role =
  | 'leadership' | 'admin' | 'coordinator'
  | 'area_housing' | 'area_arenas'
  | 'school_staff' | 'arena_staff' | 'volunteer'
  // Domänroller. Vilka moduler de når styrs av role_modules i databasen,
  // inte av tier: tier säger hur senior någon är, inte vad den jobbar med.
  | 'security_lead' | 'security_staff'
  | 'transport_staff' | 'food_staff' | 'stock_staff'
  | 'finance' | 'interpreter' | 'medic';

export function tierOf(role: Role | null | undefined): number {
  switch (role) {
    case 'leadership': return 6;
    case 'admin': return 5;
    case 'coordinator':
    case 'security_lead':
    case 'finance': return 4;
    case 'area_housing':
    case 'area_arenas': return 3;
    case 'school_staff':
    case 'arena_staff':
    case 'security_staff':
    case 'transport_staff':
    case 'food_staff':
    case 'stock_staff':
    case 'medic': return 2;
    default: return 1;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  leadership: 'Ledning', admin: 'Admin', coordinator: 'Koordinator',
  area_housing: 'Områdesansvarig (boende)', area_arenas: 'Områdesplansansvarig',
  school_staff: 'Boendevärd', arena_staff: 'Planvärd', volunteer: 'Volontär',
  security_lead: 'Säkerhetsansvarig', security_staff: 'Säkerhetspersonal',
  transport_staff: 'Transport', food_staff: 'Måltider', stock_staff: 'Lager',
  finance: 'Ekonomi', interpreter: 'Tolk', medic: 'Sjukvård'
};

// Rollerna grupperade som de visas i personalvyn
export const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: 'Ledning', roles: ['leadership', 'admin', 'coordinator'] },
  { label: 'Område', roles: ['area_housing', 'area_arenas'] },
  { label: 'Fält', roles: ['school_staff', 'arena_staff', 'volunteer'] },
  { label: 'Säkerhet', roles: ['security_lead', 'security_staff'] },
  { label: 'Drift', roles: ['transport_staff', 'food_staff', 'stock_staff', 'medic'] },
  { label: 'Stöd', roles: ['finance', 'interpreter'] }
];
