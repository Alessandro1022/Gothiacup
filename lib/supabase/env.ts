// Gemensam, städad läsning av Supabase-miljövariablerna.
// Vanliga klipp-och-klistra-fel: mellanslag runt värdet, ett avslutande
// snedstreck, eller punkten som följer med när URL:en kopieras från slutet
// av en mening. En enda extra punkt gör varje anrop till ett nätverksfel,
// vilket i Safari visas som "Load failed".

function clean(raw?: string): string {
  return (raw ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

export function supabaseUrl(): string {
  // Ta bort avslutande punkter och snedstreck, behåll resten orört
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/[./]+$/, '');
}

export function supabaseAnonKey(): string {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Tydligt fel i konsolen i stället för ett tyst trasigt anrop
export function assertSupabaseEnv(): string | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url) return 'NEXT_PUBLIC_SUPABASE_URL saknas';
  if (!key) return 'NEXT_PUBLIC_SUPABASE_ANON_KEY saknas';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return `NEXT_PUBLIC_SUPABASE_URL ser fel ut: ${url}`;
  }
  return null;
}
