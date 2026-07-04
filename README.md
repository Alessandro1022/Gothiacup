# TournamentOps — Del 1 (Fundament)

Ladda upp ALLA filer/mappar till roten av ditt GitHub-repo (behåll mappstrukturen exakt).

## Ordning
1. Kör `supabase/schema.sql` i Supabase SQL Editor.
2. Ladda upp resten till GitHub → koppla till Vercel.
3. Env-variabler i Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_TENANT = GOTHIA  (byt till PARTILLE för handbollstema)
4. Skapa första användaren i Supabase (Auth → Users → Add user), sätt sedan:
   update public.profiles set role = 'leadership', full_name = 'Albert' where email = 'DIN@EPOST.SE';
