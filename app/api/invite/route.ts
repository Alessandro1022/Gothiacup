// Inbjudningar: admin anger e-post + roll + scope.
// Supabase skickar inbjudningsmejlet; apply_invite-triggern sätter roll/scope vid första inloggning.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { tierOf, type Role } from '@/lib/types';
import { supabaseUrl } from '@/lib/supabase/env';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (tierOf((profile?.role ?? 'volunteer') as Role) < 5) {
    return NextResponse.json({ error: 'Endast admin kan bjuda in' }, { status: 403 });
  }

  const { email, role, areaId, locationType, locationId } = await req.json().catch(() => ({}));
  if (!email || !/.+@.+\..+/.test(email)) return NextResponse.json({ error: 'Ogiltig e-post' }, { status: 400 });

  const service = createSupabase(
    supabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1) Stage:a roll + scope
  const { error: invErr } = await service.from('invites').insert({
    email, role: role || 'volunteer',
    area_id: areaId || null,
    location_type: locationType || null,
    location_id: locationId || null,
    invited_by: user.id
  });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  // 2) Skicka Supabase-inbjudan
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
