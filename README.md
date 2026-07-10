# TournamentOps — Del 3 (Enterprise)

Kräver att **Del 1 och Del 2 är uppe**.

## Körordning

1. Kör `supabase/schema_part3.sql` i Supabase SQL Editor.
2. Ladda upp alla filer/mappar till roten av repot (samma sökvägar skrivs över — det är meningen).
   **Viktigt:** `package.json` ersätts (ny dependency: `qrcode.react`). Vercel installerar automatiskt.
3. Vercel bygger om. Inga nya env-variabler.

## Ny design — Gothia Cup-stil

Hela appen är omgjord för att matcha gothiacup.se: ljust, vitt, rundade kort, deras blå som
primärfärg och gul accent. Mörkblå sidomeny/topbar. Partille-tenanten får samma struktur i grönt.
Snabbare också: alla tunga effekter (blur, 3D, scanning) är borttagna, och sidbyten visar
direkt ett laddningsskelett (`app/(app)/loading.tsx`) istället för att kännas frusna.
Mobil: ny bottennav (Översikt · Incidenter · Pass · Chatt · Mer) med stora touch-ytor.

## NYA funktioner

| Sida | Vad |
|---|---|
| **Rapporter** (tier ≥ 3) | BI: incidenter per dag/allvarlighet, öppna vs lösta, passtäckning live, beläggning per skola. |
| **Nyheter** | Nyhetsflöde från ledningen (tier ≥ 4 publicerar), fäst inlägg, synlighetsnivå per inlägg. |
| **Chatt** | Realtidschatt: Allmänt (alla), Ledning (tier ≥ 4), en kanal per område (scope styr). |
| **Dokument** | Länkbibliotek per kategori med synlighetsnivå. Tier ≥ 4 hanterar. |
| **Krisläge** (tier ≥ 5) | Aktivera med meddelande → röd banner visas direkt för all personal på alla sidor (realtime). |
| **Inställningar** (tier ≥ 5) | Runtime white-label: byt eventnamn + primärfärg live för alla, utan omdeploy. |
| **Incidentdetalj** | Klicka på valfri incident → full detalj: redigera allt, tilldela, kommentarstråd i realtid, radera. |
| **Pass-byten** | Personal begär byte på sina pass; chefer godkänner/nekar. Godkänt byte öppnar passet för omtillsättning. |
| **QR-/kodincheckning** | Varje pass har en kod. Chefer visar QR (skannas med mobilkameran) eller så anger personalen koden på Pass-sidan. |
| **PWA-grund** | Service worker cachar statiska filer och senast besökta sidor som offline-fallback. |

## Redigera/radera överallt

Lag (redigera alla fält + radera), matcher (redigera + radera), klassrum, felanmälningar,
nycklar, uppgifter (klicka på titeln i kanban → redigera; papperskorg raderar), incidenter
(via detaljsidan), pass, nyheter, dokument.

## ERSÄTTER (skriv över)

`package.json`, `lib/tenant.ts`, `lib/i18n.ts`, `app/layout.tsx`, `app/globals.css`,
`components/Shell.tsx`, `components/tasks/TasksClient.tsx`, `components/incidents/IncidentsClient.tsx`,
`components/shifts/ShiftsClient.tsx`, `components/schools/SchoolDetailClient.tsx`,
`components/arenas/ArenaDetailClient.tsx`

## Testa

1. Ny look direkt efter deploy — ljus Gothia-stil, bottennav på mobilen.
2. Incidenter → klicka en titel → redigera, kommentera från två webbläsare (realtid).
3. Pass → skapa pass på dig själv → "Visa QR" → skanna med mobilen → incheckad.
4. Krisläge → aktivera → röd banner överallt, direkt.
5. Inställningar → byt primärfärg → hela appen byter färg live.
