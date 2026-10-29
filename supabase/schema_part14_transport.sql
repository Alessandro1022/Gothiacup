-- TournamentOps · Del 14 · Transport och logistik
-- ============================================================================
-- Andra modulen i etapp 2. Hakar i lagret: när ett uppdrag kvitteras som
-- levererat bokas materielen automatiskt om från avsändare till mottagare.
-- Utan den kopplingen hade personalen fått registrera samma leverans två
-- gånger, och i praktiken hade den andra gången inte blivit av.
--
-- Kör efter schema_part13_lager.sql.
-- ============================================================================

-- ============ 1. FORDON ============
do $$
begin
  create type vehicle_kind as enum ('buss', 'lastbil', 'skapbil', 'personbil', 'annat');
exception when duplicate_object then null;
end $$;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  label text not null,                          -- 'Buss 3', 'Skåpbil A'
  kind vehicle_kind not null default 'skapbil',
  plate text not null default '',
  seats int,                                    -- hur många personer
  driver_name text not null default '',
  driver_phone text not null default '',
  active boolean not null default true,
  -- Frivillig positionsdelning. Fylls bara när föraren slagit på den, och
  -- läses bara av dem som når transportmodulen.
  share_position boolean not null default false,
  last_lat double precision,
  last_lng double precision,
  last_seen timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicles_tenant on public.vehicles (tenant_id, active);

-- ============ 2. UPPDRAG ============
do $$
begin
  create type transport_kind as enum ('lag', 'personal', 'materiel', 'mat', 'annat');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type transport_status as enum ('planerad', 'tilldelad', 'pagar', 'levererad', 'forsenad', 'installd');
exception when duplicate_object then null;
end $$;

create table if not exists public.transport_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  title text not null,
  kind transport_kind not null default 'materiel',
  status transport_status not null default 'planerad',
  urgent boolean not null default false,        -- akut transport

  -- Var ifrån och vart. Null plats betyder centrallager, som i lagret.
  from_location_type location_type,
  from_location_id uuid,
  to_location_type location_type,
  to_location_id uuid,
  from_text text not null default '',           -- när det inte är en registrerad plats
  to_text text not null default '',

  scheduled_at timestamptz,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  team_assignment_id uuid references public.team_assignments(id) on delete set null,
  people int,                                   -- antal personer vid lag- och personaltransport

  confirm_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  delivered_at timestamptz,
  delivered_by uuid references public.profiles(id),
  delay_reason text not null default '',
  distance_km numeric(7,1),
  note text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_transport_tenant on public.transport_jobs (tenant_id, status);
create index if not exists idx_transport_vehicle on public.transport_jobs (vehicle_id, scheduled_at);

-- Vad som ska med. Kopplingen till lagret som gör ombokningen möjlig.
create table if not exists public.transport_job_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  job_id uuid not null references public.transport_jobs(id) on delete cascade,
  item_id uuid references public.stock_items(id) on delete set null,
  free_text text not null default '',           -- för sådant som inte finns i lagret
  qty int not null default 1 check (qty > 0)
);

create index if not exists idx_tji_job on public.transport_job_items (job_id);

-- ============ 3. LEVERANS BOKAR OM LAGRET ============
-- Körs när ett uppdrag går till levererat. Varje post som pekar på en
-- lagerartikel blir en flytt i rörelsejournalen.
--
-- Villkoret på gamla statusen gör att en omsparad rad inte bokar om en
-- gång till: utan det hade varje redigering av ett levererat uppdrag
-- dubblerat materielen.
create or replace function public.transport_deliver() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'levererad' and old.status is distinct from 'levererad' then
    if new.delivered_at is null then
      new.delivered_at := now();
    end if;

    insert into public.stock_movements
      (tenant_id, item_id, kind, qty,
       location_type, location_id, to_location_type, to_location_id, note, moved_by)
    select
      new.tenant_id, i.item_id, 'flytt', i.qty,
      new.from_location_type, new.from_location_id,
      new.to_location_type, new.to_location_id,
      'Transport: ' || new.title, new.delivered_by
    from public.transport_job_items i
    where i.job_id = new.id and i.item_id is not null;
  end if;
  return new;
end $$;

drop trigger if exists trg_transport_deliver on public.transport_jobs;
create trigger trg_transport_deliver before update on public.transport_jobs
  for each row execute function public.transport_deliver();

-- ============ 4. KVITTERING MED KOD ============
-- Mottagaren läser av koden. SECURITY DEFINER så att en boendevärd kan
-- kvittera utan skrivrätt i transportmodulen, men bara inom sin turnering.
create or replace function public.confirm_transport(code text)
returns table (ok boolean, title text, status transport_status)
language plpgsql security definer set search_path = public as $$
declare j record;
begin
  select * into j from public.transport_jobs
   where confirm_code = code and tenant_id = public.my_tenant();

  if j.id is null then
    return query select false, 'Okänd kod'::text, null::transport_status;
    return;
  end if;

  if j.status = 'levererad' then
    return query select false, j.title, j.status;
    return;
  end if;

  update public.transport_jobs
     set status = 'levererad', delivered_at = now(), delivered_by = auth.uid()
   where id = j.id;

  return query select true, j.title, 'levererad'::transport_status;
end $$;

revoke execute on function public.confirm_transport(text) from public, anon;
grant execute on function public.confirm_transport(text) to authenticated;

-- ============ 5. DAGENS KÖRNINGAR ============
create or replace view public.transport_board
with (security_invoker = on) as
select
  j.id, j.tenant_id, j.title, j.kind, j.status, j.urgent, j.scheduled_at,
  j.people, j.distance_km, j.delay_reason, j.delivered_at, j.confirm_code, j.note,
  v.label as vehicle_label, v.driver_name, v.driver_phone,
  coalesce(nullif(j.from_text, ''), case j.from_location_type
    when 'school' then (select s.name from public.schools s where s.id = j.from_location_id)
    when 'arena'  then (select a.name from public.arenas a where a.id = j.from_location_id)
    else 'Centrallager' end) as from_name,
  coalesce(nullif(j.to_text, ''), case j.to_location_type
    when 'school' then (select s.name from public.schools s where s.id = j.to_location_id)
    when 'arena'  then (select a.name from public.arenas a where a.id = j.to_location_id)
    else 'Centrallager' end) as to_name,
  (select count(*) from public.transport_job_items i where i.job_id = j.id) as item_count
from public.transport_jobs j
left join public.vehicles v on v.id = j.vehicle_id;

grant select on public.transport_board to authenticated;

-- ============ 6. BEHÖRIGHET ============
alter table public.vehicles enable row level security;
alter table public.transport_jobs enable row level security;
alter table public.transport_job_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vehicles', 'transport_jobs', 'transport_job_items'] loop
    execute format('drop policy if exists "transport läs" on public.%I', t);
    execute format(
      'create policy "transport läs" on public.%I for select to authenticated
         using (public.can_module(''transport''))', t);

    execute format('drop policy if exists "transport skriv" on public.%I', t);
    execute format(
      'create policy "transport skriv" on public.%I for all to authenticated
         using (public.can_module(''transport'', true))
         with check (public.can_module(''transport'', true))', t);

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
  alter publication supabase_realtime add table public.transport_jobs;
exception when duplicate_object then null;
end $$;

-- ============ 7. MODULEN ============
select public.add_module('transport');

update public.plans set features = features || '{"transport":true}'
 where slug in ('komplett');

update public.tenants set features = features || '{"transport":true}'
 where plan_name = 'Komplett' and not plan_customized;

-- ============ 8. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='vehicles')          as fordon,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='transport_jobs')    as uppdrag,
  (select count(*) from pg_views
    where schemaname='public' and viewname='transport_board')       as tavla,
  (select level from public.role_modules
    where role='transport_staff' and module='transport')            as transportroll;
