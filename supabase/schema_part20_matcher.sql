-- TournamentOps · Del 20 · Matchdjup
-- ============================================================================
-- Etapp 4, fjärde klustret. Du satte "delvis" på hela avsnittet, och det
-- stämde: driftsidan fanns — planvärdar, planstatus, riskflaggor — medan
-- tävlingssidan saknades helt.
--
-- Kör efter schema_part19_arenden.sql.
-- ============================================================================

-- ============ 1. DOMARE ============
create table if not exists public.referees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  full_name text not null,
  phone text not null default '',
  email text not null default '',
  level text not null default '',             -- distriktsdomare, elitdomare
  languages text not null default '',
  -- Kopplas till ett konto om domaren ska logga in, annars bara registrerad
  user_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_referees_tenant on public.referees (tenant_id, active);

-- ============ 2. RESULTAT OCH ÄNDRINGAR PÅ MATCHEN ============
alter table public.arena_matches
  add column if not exists home_score int,
  add column if not exists away_score int,
  add column if not exists referee_id uuid references public.referees(id) on delete set null,
  add column if not exists referee_2_id uuid references public.referees(id) on delete set null,
  add column if not exists group_name text not null default '',   -- 'Grupp A', 'Slutspel'
  add column if not exists stage text not null default 'gruppspel',
  -- Ändringar: originaltiden sparas så att en flytt går att se i efterhand
  add column if not exists original_starts_at timestamptz,
  add column if not exists change_reason text not null default '',
  add column if not exists report text not null default '',        -- matchrapport
  add column if not exists reported_by uuid references public.profiles(id) on delete set null,
  add column if not exists reported_at timestamptz,
  -- Walkover och protest
  add column if not exists walkover_team text not null default '',
  add column if not exists protest text not null default '',
  add column if not exists protest_status text not null default '';

create index if not exists idx_matches_group
  on public.arena_matches (tenant_id, group_name, starts_at);

-- ============ 3. FLYTT OCH INSTÄLLNING GER NOTIS ============
-- En match som flyttas utan att planvärden får veta betyder att någon står
-- på fel plan vid fel tid. Notisen går till alla med scope på arenan.
create or replace function public.notify_match_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  arena_namn text;
  nar text;
  rubrik text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Spara originaltiden första gången matchen flyttas
  if new.starts_at is distinct from old.starts_at and new.original_starts_at is null then
    new.original_starts_at := old.starts_at;
  end if;

  if new.starts_at is not distinct from old.starts_at
     and new.status is not distinct from old.status then
    return new;
  end if;

  select a.name into arena_namn from public.arenas a where a.id = new.arena_id;
  nar := to_char(new.starts_at at time zone 'Europe/Stockholm', 'DD/MM HH24:MI');

  rubrik := case
    when new.status = 'cancelled' then 'Match inställd'
    when new.starts_at is distinct from old.starts_at then 'Match flyttad'
    else 'Match ändrad'
  end;

  insert into public.notifications (user_id, title, body, tenant_id)
  select distinct sc.user_id, rubrik,
         new.home_team || ' – ' || new.away_team || ' · ' ||
         coalesce(arena_namn, 'okänd plan') || ' · ' || nar ||
         case when new.change_reason <> '' then ' · ' || new.change_reason else '' end,
         new.tenant_id
  from public.staff_scope sc
  where (sc.location_type = 'arena' and sc.location_id = new.arena_id)
     or (sc.area_id is not null and sc.area_id = (
           select a.area_id from public.arenas a where a.id = new.arena_id));

  return new;
end $$;

drop trigger if exists trg_notify_match on public.arena_matches;
create trigger trg_notify_match before update on public.arena_matches
  for each row execute function public.notify_match_change();

-- ============ 4. TABELL OCH POÄNG ============
-- Poängberäkningen ligger i databasen, inte i klienten: samma siffror ska
-- gälla oavsett vem som frågar. Tre poäng för vinst, en för oavgjort.
-- Walkover räknas som 3–0 till motståndaren.
create or replace view public.group_standings
with (security_invoker = on) as
with spelade as (
  select
    m.tenant_id, m.group_name, m.category,
    m.home_team as team,
    case when m.walkover_team = m.home_team then 0
         when m.walkover_team = m.away_team then 3
         else m.home_score end as gf,
    case when m.walkover_team = m.home_team then 3
         when m.walkover_team = m.away_team then 0
         else m.away_score end as ga
  from public.arena_matches m
  where m.status = 'finished'
    and (m.walkover_team <> '' or (m.home_score is not null and m.away_score is not null))

  union all

  select
    m.tenant_id, m.group_name, m.category,
    m.away_team,
    case when m.walkover_team = m.away_team then 0
         when m.walkover_team = m.home_team then 3
         else m.away_score end,
    case when m.walkover_team = m.away_team then 3
         when m.walkover_team = m.home_team then 0
         else m.home_score end
  from public.arena_matches m
  where m.status = 'finished'
    and (m.walkover_team <> '' or (m.home_score is not null and m.away_score is not null))
)
select
  tenant_id, group_name, category, team,
  count(*)                                   as played,
  count(*) filter (where gf > ga)            as won,
  count(*) filter (where gf = ga)            as drawn,
  count(*) filter (where gf < ga)            as lost,
  sum(gf)                                    as goals_for,
  sum(ga)                                    as goals_against,
  sum(gf) - sum(ga)                          as goal_diff,
  count(*) filter (where gf > ga) * 3
    + count(*) filter (where gf = ga)        as points
from spelade
where group_name <> ''
group by tenant_id, group_name, category, team;

grant select on public.group_standings to authenticated;

-- ============ 5. BEHÖRIGHET ============
alter table public.referees enable row level security;

drop policy if exists "domare läs" on public.referees;
create policy "domare läs" on public.referees for select to authenticated
  using (public.can_module('arenas'));

drop policy if exists "domare skriv" on public.referees;
create policy "domare skriv" on public.referees for all to authenticated
  using (public.my_tier() >= 4) with check (public.my_tier() >= 4);

drop policy if exists "tenant isolering" on public.referees;
create policy "tenant isolering" on public.referees
  as restrictive for all to authenticated
  using (tenant_id = public.my_tenant()) with check (tenant_id = public.my_tenant());

-- ============ 6. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='referees')          as domarregister,
  (select count(*) from information_schema.columns
    where table_name='arena_matches'
      and column_name in ('home_score','away_score','report','protest','walkover_team')) as nya_matchfalt,
  (select count(*) from pg_views
    where schemaname='public' and viewname='group_standings')       as tabellvy,
  (select count(*) from pg_trigger where tgname='trg_notify_match') as notistrigger;
