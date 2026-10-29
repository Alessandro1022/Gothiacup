-- TournamentOps · Del 16 · Ekonomi
-- ============================================================================
-- Etapp 3. Modulen räknar ingenting själv — den summerar vad transport,
-- lager, måltider och pass rapporterar in. Byggd före dem hade den stått tom,
-- och det är hela skälet till att den kommer sist.
--
-- Samma mönster som lagret: KOSTNADSJOURNALEN är sanningen, summorna är
-- vyer. "Spåra läckor" betyder att se var pengarna försvann, och det går
-- bara om varje krona har en rad med ett ursprung.
--
-- OM LÖNER: personalkostnad räknas per ROLL och timme, aldrig per person.
-- En timpeng per individ är en uppgift om den personens lön, och den hör
-- inte hemma i ett driftsystem som hela organisationen loggar in i.
--
-- Kör efter schema_part15_maltider.sql.
-- ============================================================================

-- ============ 1. PRISUPPGIFTER PÅ DET SOM REDAN FINNS ============
alter table public.vehicles
  add column if not exists cost_per_km numeric(8,2);

alter table public.transport_jobs
  add column if not exists cost numeric(10,2);          -- fast kostnad, utöver körsträcka

alter table public.stock_items
  add column if not exists unit_cost numeric(10,2);     -- vad en enhet kostar att ersätta

alter table public.meal_services
  add column if not exists cost_per_portion numeric(8,2);

alter table public.schools
  add column if not exists cost_per_night numeric(10,2); -- främst hotell

-- Timpeng per roll, inte per person.
create table if not exists public.role_rates (
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  role app_role not null,
  hourly_rate numeric(8,2) not null default 0,
  primary key (tenant_id, role)
);

-- ============ 2. KOSTNADSJOURNALEN ============
do $$
begin
  create type cost_category as enum
    ('personal', 'boende', 'transport', 'material', 'maltider', 'ovrigt', 'intakt');
exception when duplicate_object then null;
end $$;

create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  category cost_category not null,
  amount numeric(12,2) not null,        -- kostnad positiv, intäkt positiv i kategorin intakt
  entry_date date not null default (now() at time zone 'Europe/Stockholm')::date,
  description text not null default '',

  -- Varifrån posten kom. Ger spårbarheten som gör läckor hittbara.
  source_table text not null default 'manuell',
  source_id uuid,

  -- Vad kostnaden hör till, när det går att säga
  team_assignment_id uuid references public.team_assignments(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_tenant on public.cost_entries (tenant_id, category, entry_date);
create index if not exists idx_cost_source on public.cost_entries (source_table, source_id);
create index if not exists idx_cost_team on public.cost_entries (team_assignment_id);

-- En källa får bara ge en post. Utan det skulle en omsparad transport eller
-- en omräknad måltid lägga på kostnaden en gång till varje gång.
create unique index if not exists uq_cost_source
  on public.cost_entries (source_table, source_id)
  where source_id is not null;

-- ============ 3. MODULERNA SKRIVER TILL JOURNALEN ============

-- Transport: körsträcka gånger kilometerpris, plus eventuell fast kostnad.
create or replace function public.cost_from_transport() returns trigger
language plpgsql security definer set search_path = public as $$
declare belopp numeric(12,2);
begin
  if new.status <> 'levererad' then
    return new;
  end if;

  select coalesce(new.cost, 0)
       + coalesce(new.distance_km, 0) * coalesce(v.cost_per_km, 0)
    into belopp
  from public.vehicles v where v.id = new.vehicle_id;

  belopp := coalesce(belopp, coalesce(new.cost, 0));
  if belopp is null or belopp = 0 then
    return new;
  end if;

  insert into public.cost_entries
    (tenant_id, category, amount, entry_date, description,
     source_table, source_id, team_assignment_id, created_by)
  values
    (new.tenant_id, 'transport', belopp,
     coalesce(new.delivered_at, now())::date,
     'Transport: ' || new.title,
     'transport_jobs', new.id, new.team_assignment_id, new.delivered_by)
  on conflict (source_table, source_id) where source_id is not null
  do update set amount = excluded.amount, entry_date = excluded.entry_date;

  return new;
end $$;

drop trigger if exists trg_cost_transport on public.transport_jobs;
create trigger trg_cost_transport after update on public.transport_jobs
  for each row execute function public.cost_from_transport();

-- Måltider: serverade portioner gånger portionspris. Svinn bokförs separat
-- så att det går att se vad som slängdes — det är ofta där läckan finns.
create or replace function public.cost_from_meals() returns trigger
language plpgsql security definer set search_path = public as $$
declare pris numeric(8,2) := coalesce(new.cost_per_portion, 0);
begin
  if pris = 0 then
    return new;
  end if;

  if coalesce(new.served, 0) > 0 then
    insert into public.cost_entries
      (tenant_id, category, amount, entry_date, description, source_table, source_id)
    values
      (new.tenant_id, 'maltider', new.served * pris, new.service_date,
       'Serverat: ' || new.meal, 'meal_services', new.id)
    on conflict (source_table, source_id) where source_id is not null
    do update set amount = excluded.amount;
  end if;

  if coalesce(new.wasted, 0) > 0 then
    insert into public.cost_entries
      (tenant_id, category, amount, entry_date, description, source_table, source_id)
    values
      (new.tenant_id, 'maltider', new.wasted * pris, new.service_date,
       'Svinn: ' || new.meal, 'meal_services_waste', new.id)
    on conflict (source_table, source_id) where source_id is not null
    do update set amount = excluded.amount;
  end if;

  return new;
end $$;

drop trigger if exists trg_cost_meals on public.meal_services;
create trigger trg_cost_meals after insert or update on public.meal_services
  for each row execute function public.cost_from_meals();

-- Lager: skadat och förlorat är en kostnad. Flytt och uttag är det inte —
-- materielen finns kvar, den står bara någon annanstans.
create or replace function public.cost_from_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare pris numeric(10,2);
begin
  if new.kind not in ('skadad', 'forlorad') then
    return new;
  end if;

  select unit_cost into pris from public.stock_items where id = new.item_id;
  if coalesce(pris, 0) = 0 then
    return new;
  end if;

  insert into public.cost_entries
    (tenant_id, category, amount, entry_date, description,
     source_table, source_id, school_id, created_by)
  values
    (new.tenant_id, 'material', new.qty * pris, new.moved_at::date,
     (case new.kind when 'skadad' then 'Skadat: ' else 'Förlorat: ' end) ||
       (select name from public.stock_items where id = new.item_id),
     'stock_movements', new.id,
     case when new.location_type = 'school' then new.location_id end,
     new.moved_by)
  on conflict (source_table, source_id) where source_id is not null do nothing;

  return new;
end $$;

drop trigger if exists trg_cost_stock on public.stock_movements;
create trigger trg_cost_stock after insert on public.stock_movements
  for each row execute function public.cost_from_stock();

-- ============ 4. BUDGET ============
create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  category cost_category not null,
  name text not null,
  planned numeric(12,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_budget_tenant on public.budget_lines (tenant_id, category);

-- ============ 5. BUDGET MOT UTFALL ============
-- Det här är vyn som visar läckorna: planerat mot faktiskt, per kategori,
-- med avvikelsen uträknad. Intäkter hanteras som egen kategori och räknas
-- inte av mot kostnaderna här — det hade dolt var pengarna tar vägen.
create or replace view public.budget_vs_actual
with (security_invoker = on) as
select
  t.id as tenant_id,
  c.category,
  coalesce(b.planned, 0)                                  as planned,
  coalesce(a.actual, 0)                                   as actual,
  coalesce(a.actual, 0) - coalesce(b.planned, 0)          as deviation,
  case when coalesce(b.planned, 0) = 0 then null
       else round(coalesce(a.actual, 0) / b.planned * 100) end as pct_of_budget,
  coalesce(a.entries, 0)                                  as entries
from public.tenants t
cross join (select unnest(enum_range(null::cost_category)) as category) c
left join (
  select tenant_id, category, sum(planned) as planned
  from public.budget_lines group by tenant_id, category
) b on b.tenant_id = t.id and b.category = c.category
left join (
  select tenant_id, category, sum(amount) as actual, count(*) as entries
  from public.cost_entries group by tenant_id, category
) a on a.tenant_id = t.id and a.category = c.category;

grant select on public.budget_vs_actual to authenticated;

-- Kostnad per lag och per deltagare. Deltagarantalet tas från faktiskt
-- registrerade personer, inte från anmäld gruppstorlek.
create or replace view public.cost_per_team
with (security_invoker = on) as
select
  ta.tenant_id,
  ta.id as team_assignment_id,
  ta.team_name,
  ta.club_name,
  r.registered,
  coalesce(sum(ce.amount) filter (where ce.category <> 'intakt'), 0) as cost,
  coalesce(sum(ce.amount) filter (where ce.category = 'intakt'), 0)  as revenue,
  case when coalesce(r.registered, 0) = 0 then null
       else round(coalesce(sum(ce.amount) filter (where ce.category <> 'intakt'), 0)
                  / r.registered, 2) end as cost_per_participant
from public.team_assignments ta
left join public.team_roster_stats r on r.team_assignment_id = ta.id
left join public.cost_entries ce on ce.team_assignment_id = ta.id
group by ta.tenant_id, ta.id, ta.team_name, ta.club_name, r.registered;

grant select on public.cost_per_team to authenticated;

-- ============ 6. BEHÖRIGHET ============
alter table public.cost_entries enable row level security;
alter table public.budget_lines enable row level security;
alter table public.role_rates enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cost_entries', 'budget_lines', 'role_rates'] loop
    execute format('drop policy if exists "ekonomi läs" on public.%I', t);
    execute format(
      'create policy "ekonomi läs" on public.%I for select to authenticated
         using (public.can_module(''finance''))', t);

    execute format('drop policy if exists "ekonomi skriv" on public.%I', t);
    execute format(
      'create policy "ekonomi skriv" on public.%I for all to authenticated
         using (public.can_module(''finance'', true))
         with check (public.can_module(''finance'', true))', t);

    execute format('drop policy if exists "tenant isolering" on public.%I', t);
    execute format(
      'create policy "tenant isolering" on public.%I
         as restrictive for all to authenticated
         using (tenant_id = public.my_tenant())
         with check (tenant_id = public.my_tenant())', t);
  end loop;
end $$;

-- ============ 7. MODULEN ============
select public.add_module('finance');

update public.plans set features = features || '{"finance":true}'
 where slug in ('komplett');

update public.tenants set features = features || '{"finance":true}'
 where plan_name = 'Komplett' and not plan_customized;

-- ============ 8. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='cost_entries')    as journal,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='budget_lines')    as budget,
  (select count(*) from pg_views
    where schemaname='public' and viewname in ('budget_vs_actual','cost_per_team')) as vyer,
  (select count(*) from pg_trigger
    where tgname in ('trg_cost_transport','trg_cost_meals','trg_cost_stock')) as triggrar;
