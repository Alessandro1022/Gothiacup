-- TournamentOps · Del 15 · Måltider
-- ============================================================================
-- Sista modulen i etapp 2. Bygger på deltagarna från del 11: utan personer
-- blir måltidsrättigheter en siffra per lag, och då går det inte att se vem
-- som ätit eller hur många portioner som faktiskt behövs.
--
-- SPECIALKOST OCH ALLERGIER LIGGER INTE HÄR, med flit. Det är hälsodata om
-- minderåriga, och det kräver lagringstider, begränsad åtkomst och en
-- rutin för radering. Lägger man in fälten nu kommer de fyllas med riktiga
-- uppgifter innan den rutinen finns, och då går de inte att få bort.
-- Byggs tillsammans med GDPR-arbetet i etapp 5.
--
-- Kör efter schema_part14_transport.sql.
-- ============================================================================

-- ============ 1. MATSALAR ============
create table if not exists public.dining_halls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  name text not null,
  area_id uuid references public.areas(id) on delete set null,
  address text not null default '',
  lat double precision,
  lng double precision,
  seats int,                                   -- hur många som får plats samtidigt
  contact_name text not null default '',
  contact_phone text not null default '',
  supplier text not null default '',           -- matleverantör
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_dining_tenant on public.dining_halls (tenant_id, active);

do $$
begin
  create type meal_kind as enum ('frukost', 'lunch', 'middag', 'kvall');
exception when duplicate_object then null;
end $$;

-- Öppettider per matsal och måltid. En rad per måltid och dag, så att en
-- matsal kan ha olika tider olika dagar utan att modellen krånglar till sig.
create table if not exists public.meal_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  hall_id uuid not null references public.dining_halls(id) on delete cascade,
  service_date date not null,
  meal meal_kind not null,
  opens_at time not null,
  closes_at time not null,
  -- Vad som faktiskt gick åt. Fylls i efteråt av matsalsansvarig.
  served int,
  wasted int,
  delivered_portions int,                      -- vad leverantören lämnade
  delivery_confirmed_at timestamptz,
  notes text not null default '',
  unique (hall_id, service_date, meal)
);

create index if not exists idx_meal_services_date on public.meal_services (tenant_id, service_date);

-- ============ 2. RÄTTIGHETER ============
-- Vilka måltider ett lag har betalt för, och var de äter. Rättigheten
-- sitter på laget, inte på personen: det är så paketen säljs.
create table if not exists public.meal_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  team_assignment_id uuid not null references public.team_assignments(id) on delete cascade,
  hall_id uuid references public.dining_halls(id) on delete set null,
  meal meal_kind not null,
  from_date date,
  to_date date,
  unique (team_assignment_id, meal)
);

create index if not exists idx_entitlements_team on public.meal_entitlements (team_assignment_id);

-- ============ 3. AVPRICKNING ============
-- En rad per person och måltid. Unikt på deltagare, datum och måltid, så
-- att samma kort inte kan prickas av två gånger på samma mål.
create table if not exists public.meal_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  hall_id uuid references public.dining_halls(id) on delete set null,
  service_date date not null default (now() at time zone 'Europe/Stockholm')::date,
  meal meal_kind not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references public.profiles(id),
  unique (participant_id, service_date, meal)
);

create index if not exists idx_meal_checkins_day
  on public.meal_checkins (tenant_id, service_date, meal);

-- ============ 4. PROGNOS ============
-- Hur många portioner som behövs per matsal, dag och måltid. Räknas ur
-- lagens rättigheter och deras faktiska deltagarantal — inte ur anmäld
-- gruppstorlek, som nästan alltid är inaktuell vid ankomst.
create or replace view public.meal_forecast
with (security_invoker = on) as
select
  e.tenant_id,
  e.hall_id,
  h.name as hall_name,
  d.service_date,
  e.meal,
  count(distinct e.team_assignment_id)                       as teams,
  coalesce(sum(r.registered), 0)::int                        as expected,
  coalesce(sum(r.checked_in), 0)::int                         as checked_in_teams
from public.meal_entitlements e
join public.dining_halls h on h.id = e.hall_id
join public.team_roster_stats r on r.team_assignment_id = e.team_assignment_id
cross join lateral (
  select generate_series(
    greatest(coalesce(e.from_date, r.arrival_date, current_date), coalesce(r.arrival_date, current_date)),
    least(coalesce(e.to_date, r.departure_date, current_date), coalesce(r.departure_date, current_date)),
    interval '1 day'
  )::date as service_date
) d
group by e.tenant_id, e.hall_id, h.name, d.service_date, e.meal;

grant select on public.meal_forecast to authenticated;

-- Prognos mot utfall, det matsalsansvarig behöver för att beställa rätt
create or replace view public.meal_board
with (security_invoker = on) as
select
  s.tenant_id, s.id as service_id, s.hall_id, h.name as hall_name,
  s.service_date, s.meal, s.opens_at, s.closes_at,
  s.delivered_portions, s.served, s.wasted, s.delivery_confirmed_at, s.notes,
  coalesce(f.expected, 0) as expected,
  (select count(*) from public.meal_checkins c
    where c.hall_id = s.hall_id and c.service_date = s.service_date and c.meal = s.meal) as checked_in,
  case
    when s.delivered_portions is null then null
    else s.delivered_portions - coalesce(f.expected, 0)
  end as delivery_gap
from public.meal_services s
join public.dining_halls h on h.id = s.hall_id
left join public.meal_forecast f
  on f.hall_id = s.hall_id and f.service_date = s.service_date and f.meal = s.meal;

grant select on public.meal_board to authenticated;

-- ============ 5. AVPRICKNING MOT KORTET ============
-- Personalen läser deltagarens kod. Funktionen svarar om personen har rätt
-- till målet, och prickar av i samma anrop.
create or replace function public.meal_check(code text, m meal_kind, hall uuid default null)
returns table (ok boolean, reason text, full_name text, team_name text)
language plpgsql security definer set search_path = public as $$
declare
  p record;
  ent record;
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  select pa.id, pa.full_name, ta.id as team_id, ta.team_name, pa.tenant_id
    into p
  from public.participants pa
  join public.team_assignments ta on ta.id = pa.team_assignment_id
  where pa.card_code = code and pa.tenant_id = public.my_tenant();

  if p.id is null then
    return query select false, 'Okänt kort'::text, null::text, null::text;
    return;
  end if;

  select * into ent from public.meal_entitlements e
   where e.team_assignment_id = p.team_id and e.meal = m
     and (e.from_date is null or today >= e.from_date)
     and (e.to_date is null or today <= e.to_date);

  if ent.id is null then
    return query select false, 'Ingen rätt till det här målet'::text, p.full_name, p.team_name;
    return;
  end if;

  if exists (
    select 1 from public.meal_checkins c
    where c.participant_id = p.id and c.service_date = today and c.meal = m
  ) then
    return query select false, 'Redan avprickad'::text, p.full_name, p.team_name;
    return;
  end if;

  insert into public.meal_checkins (tenant_id, participant_id, hall_id, meal, checked_by)
  values (p.tenant_id, p.id, coalesce(hall, ent.hall_id), m, auth.uid());

  return query select true, 'Avprickad'::text, p.full_name, p.team_name;
end $$;

revoke execute on function public.meal_check(text, meal_kind, uuid) from public, anon;
grant execute on function public.meal_check(text, meal_kind, uuid) to authenticated;

-- ============ 6. BEHÖRIGHET ============
alter table public.dining_halls enable row level security;
alter table public.meal_services enable row level security;
alter table public.meal_entitlements enable row level security;
alter table public.meal_checkins enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dining_halls', 'meal_services', 'meal_entitlements', 'meal_checkins'] loop
    execute format('drop policy if exists "maltid läs" on public.%I', t);
    execute format(
      'create policy "maltid läs" on public.%I for select to authenticated
         using (public.can_module(''meals''))', t);

    execute format('drop policy if exists "maltid skriv" on public.%I', t);
    execute format(
      'create policy "maltid skriv" on public.%I for all to authenticated
         using (public.can_module(''meals'', true))
         with check (public.can_module(''meals'', true))', t);

    execute format('drop policy if exists "tenant isolering" on public.%I', t);
    execute format(
      'create policy "tenant isolering" on public.%I
         as restrictive for all to authenticated
         using (tenant_id = public.my_tenant())
         with check (tenant_id = public.my_tenant())', t);
  end loop;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meal_checkins;
exception when duplicate_object then null;
end $$;

-- ============ 7. MODULEN ============
select public.add_module('meals');

update public.plans set features = features || '{"meals":true}'
 where slug in ('komplett');

update public.tenants set features = features || '{"meals":true}'
 where plan_name = 'Komplett' and not plan_customized;

-- ============ 8. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='dining_halls')       as matsalar,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='meal_checkins')      as avprickning,
  (select count(*) from pg_views
    where schemaname='public' and viewname in ('meal_forecast','meal_board')) as vyer,
  (select level from public.role_modules
    where role='food_staff' and module='meals')                      as matroll;
