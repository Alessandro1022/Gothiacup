# TournamentOps — Del 4 (AI, säkerhet, inbjudningar, historik)

Kräver Del 1–3.

## Körordning

1. Kör `supabase/schema_part4.sql` i Supabase SQL Editor.
2. Lägg till TRE miljövariabler i Vercel (Settings → Environment Variables):
   - `GEMINI_API_KEY` — skapa gratis på https://aistudio.google.com → Get API key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API → service_role (hemlig!)
   - `CRON_SECRET` — valfri lång slumpsträng (skyddar cron-endpointen)
3. Ladda upp alla filer/mappar till repot (samma sökvägar skrivs över).
4. Vercel bygger om. Klart.

## AI-assistenten (`/ai`)

- **Automatiska rapporter 07:00 och 21:00 svensk tid** (Vercel Cron):
  - **Översikt** — för ledningen: läget, att agera på, incidenter senaste dygnet, bemanning, prognos.
  - **Skolor** — för skolvärdarna: vilka skolor behöver uppmärksamhet, beläggning, öppna fel, nattronder, att-göra-lista.
  - **Säkerhet** — körorder för de 4 säkerhetsbilarna (se nedan).
  - **Matcher** — genereras automatiskt de dagar det finns gula/röda matcher.
- Tier ≥ 3 kan generera om manuellt. Alla tier ≥ 2 kan läsa och **fråga AI:n** fritt om läget.
- AI:n hittar inte på: den får en exakt lägesbild ur databasen (incidenter, skolor, beläggning,
  nattronder, matcher med riskflaggor, pass, publikräkningar) och skriver utifrån den.

## Riskflaggade matcher

Varje match har nu risknivå som sätts i matchredigeringen på arenasidan:
**Grön** = planvärd + domare räcker · **Gul** = matchdelegat kopplas in · **Röd** = säkerhetsgruppen.
Syns som badge i matchlistan och styr både matchrapporten och bilrutterna.

## Säkerhetsbilarnas rutter

Fyra bilar (tabellen `security_cars`) får varje morgon och kväll beräknade rutter:
skolor poängsätts (öppna incidenter, öppna fel, saknad/anmärkt nattrond, hög beläggning,
gul/röd match i området), hålls ihop områdesvis och balanseras mellan bilarna, prioritetsordnade
per bil. AI:n skriver körordern ovanpå. Allt syns under AI → Säkerhet.

## Inbjudningar

Personal → **Bjud in** (admin+): ange e-post, roll och behörighet. Supabase mejlar inbjudan;
när personen sätter lösenord och loggar in första gången appliceras roll + scope automatiskt.
OBS: Supabase inbyggda mejl har låg gräns (~2/timme). För volym: Supabase → Auth → SMTP Settings
→ koppla egen SMTP (t.ex. Resend, gratis-tier räcker långt).

## Ändringshistorik

Allt loggas nu (incidenter, uppgifter, pass, nycklar, lag, matcher, klassrum, fel, nyheter,
dokument, behörigheter). Ny sida **Historik** (tier ≥ 4) med filter per typ, och en
historiksektion på varje incidentdetalj.

## Skolvärdar

- **Fördela lag automatiskt**: knapp på skolans Lag-flik — packar otilldelade lag i klassrum
  med bäst passande ledig kapacitet (största laget först).
- Överbelagda klassrum visas med röd siffra.

## ERSÄTTER

`middleware.ts`, `lib/i18n.ts`, `components/Shell.tsx`, `components/staff/StaffClient.tsx`,
`components/arenas/ArenaDetailClient.tsx`, `components/schools/SchoolDetailClient.tsx`,
`components/incidents/IncidentDetailClient.tsx`
