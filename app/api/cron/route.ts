// Körs av Vercel Cron 05:00 och 19:00 UTC (07/21 svensk sommartid).
// Genererar morgon-/kvällsrapporter: översikt, skolor, säkerhetsrutter,
// samt matchrapport när det finns gula/röda matcher.
import { NextResponse } from 'next/server';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { generateReport } from '@/lib/ai';
import { supabaseUrl } from '@/lib/supabase/env';

export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createSupabase(
    supabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const hour = new Date().getUTCHours();
  const slot = hour < 12 ? 'morning' : 'evening';

  const results: Record<string, string> = {};
  for (const kind of ['overview', 'schools', 'security'] as const) {
    try { await generateReport(db, kind, slot); results[kind] = 'ok'; }
    catch (e) { results[kind] = e instanceof Error ? e.message : 'fel'; }
  }
  // Matchrapport endast när flaggade matcher finns idag
  try {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const t1 = new Date(); t1.setHours(23, 59, 59, 999);
    const { count } = await db.from('arena_matches')
      .select('id', { count: 'exact', head: true })
      .neq('risk_level', 'green').neq('status', 'cancelled')
      .gte('starts_at', t0.toISOString()).lte('starts_at', t1.toISOString());
    if ((count ?? 0) > 0) { await generateReport(db, 'matches', slot); results.matches = 'ok'; }
    else results.matches = 'inga flaggade';
  } catch (e) { results.matches = e instanceof Error ? e.message : 'fel'; }

  return NextResponse.json({ slot, results });
}
