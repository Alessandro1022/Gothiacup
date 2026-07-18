// AI-endpoint: generera rapporter/rutter på begäran + fråga AI:n.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tierOf, type Role } from '@/lib/types';
import { callGemini, gatherContext, generateReport, reportPrompt } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const tier = tierOf((profile?.role ?? 'volunteer') as Role);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  try {
    if (action === 'report') {
      if (tier < 3) return NextResponse.json({ error: 'Behörighet saknas' }, { status: 403 });
      const kind = ['overview', 'schools', 'security', 'matches'].includes(body.kind) ? body.kind : 'overview';
      const slot = ['morning', 'evening'].includes(body.slot) ? body.slot : 'manual';
      const text = await generateReport(supabase, kind, slot);
      return NextResponse.json({ body: text });
    }
    if (action === 'ask') {
      if (tier < 2) return NextResponse.json({ error: 'Behörighet saknas' }, { status: 403 });
      const q = String(body.question ?? '').slice(0, 500);
      if (!q) return NextResponse.json({ error: 'Ingen fråga' }, { status: 400 });
      const ctx = await gatherContext(supabase);
      const text = await callGemini(
        `${reportPrompt('overview', 'manual', ctx).split('\n\nSkriv en')[0]}\n\nBesvara frågan kort och konkret utifrån lägesbilden. Fråga: "${q}"\n\nLÄGESBILD (JSON):\n${JSON.stringify(ctx, null, 1)}`
      );
      return NextResponse.json({ body: text });
    }
    return NextResponse.json({ error: 'Okänd action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fel' }, { status: 500 });
  }
}
