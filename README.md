# TournamentOps — Del 2 (Områdesdrift)

Kräver att **Del 1 redan är uppe** (schema.sql kört, appen deployad).

## Körordning

1. Kör `supabase/schema_part2.sql` i Supabase SQL Editor (på samma projekt som Del 1).
2. Ladda upp alla filer/mappar nedan till roten av GitHub-repot (behåll strukturen exakt).
   GitHub skriver automatiskt över filer med samma sökväg — det är meningen.
3. Vercel bygger om automatiskt. Inga nya env-variabler behövs.

## NYA filer

| Fil | Vad |
|---|---|
| `supabase/schema_part2.sql` | Lag/incheckning, klassrum, nycklar, felanmälan, nattrond, matcher, säkerhetslogg, publikräkning, pass, material, checklistor. RLS via scope. |
| `app/(app)/areas/page.tsx` + `components/areas/AreasClient.tsx` | Områdesöversikt med aggregerad status per område (realtime). |
| `app/(app)/schools/page.tsx` + `components/schools/SchoolsClient.tsx` | Skollista med beläggning. |
| `app/(app)/schools/[id]/page.tsx` + `components/schools/SchoolDetailClient.tsx` | Skoldetalj: Lag / Klassrum / Felanmälan / Nattrond / Nycklar. |
| `app/(app)/arenas/page.tsx` + `components/arenas/ArenasClient.tsx` | Arenalista med LIVE-status. |
| `app/(app)/arenas/[id]/page.tsx` + `components/arenas/ArenaDetailClient.tsx` | Arenadetalj: Matcher / Säkerhetslogg / Publik / Checklistor. |
| `app/(app)/shifts/page.tsx` + `components/shifts/ShiftsClient.tsx` | Pass: egen in-/utcheckning, chefer (tier ≥ 3) skapar pass. |
| `app/(app)/staff/page.tsx` + `components/staff/StaffClient.tsx` | Personalkatalog, roller + scope (helt område eller enskild plats). Sidan kräver tier ≥ 4, redigering admin+. |

## ERSÄTTER (skriv över befintliga)

| Fil | Varför |
|---|---|
| `lib/tenant.ts` | Nya designtokens ("stadium at night"-tema). Gothia = grön glöd, Partille = blå. |
| `lib/i18n.ts` | Alla Del 1-nycklar + ~60 nya för Del 2. |
| `app/layout.tsx` | Nya CSS-variabler + holografiskt planlager i bakgrunden. |
| `app/globals.css` | Hela nya temat. Samma klassnamn — incidenter/uppgifter får nya utseendet gratis. |
| `components/Shell.tsx` | Ny nav (Översikt / Drift / Områdesdrift / Ledning) + live bemannings-% i ops-spine. |
| `app/login/page.tsx` | Ny strålkastarscen-login. |
| `components/dashboard/DashboardClient.tsx` | 6 KPI:er för chefer, "mina pass" för fältpersonal. |

## Testa

1. Dashboard: nya mörka temat + KPI "Incheckade lag".
2. Skolor → Hvitfeldtska: lägg till lag, checka in, tilldela klassrum (seedade salar finns).
3. Samma skola: lämna ut nyckel (ange innehavare), skapa felanmälan, logga nattrond.
4. Arenor → Heden: två seedade matcher, sätt en till "Pågår" → LIVE-badge på arenalistan.
5. Heden → Checklistor: starta "Öppning spelyta", bocka av — run klarmarkeras automatiskt.
6. Pass: skapa pass på dig själv, checka in → bemannings-% i sidomenyn uppdateras live.
7. Personal: byt roll på en testanvändare (endast admin+), tilldela scope för ett område.

Skriv **kör vidare** när Del 2 sitter, så levererar jag Del 3 (BI, krisläge, godkännanden, passbyte, nyhetsflöde, chatt, dokument, QR-incheckning, PWA offline).
