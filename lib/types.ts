export type Role =
  | 'leadership' | 'admin' | 'coordinator'
  | 'area_housing' | 'area_arenas'
  | 'school_staff' | 'arena_staff' | 'volunteer';

export function tierOf(role: Role | null | undefined): number {
  switch (role) {
    case 'leadership': return 6;
    case 'admin': return 5;
    case 'coordinator': return 4;
    case 'area_housing':
    case 'area_arenas': return 3;
    case 'school_staff':
    case 'arena_staff': return 2;
    default: return 1;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  leadership: 'Ledning', admin: 'Admin', coordinator: 'Koordinator',
  area_housing: 'Områdesansvarig (boende)', area_arenas: 'Områdesplansansvarig',
  school_staff: 'Skolvärd', arena_staff: 'Planvärd', volunteer: 'Volontär'
};
