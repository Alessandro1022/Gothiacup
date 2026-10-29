-- TournamentOps · Del 18 · Bemanning
-- ============================================================================
-- Etapp 4, andra klustret. Det som bränner mest under en turnering: någon
-- kommer inte, och någon annan måste hoppa in innan passet börjar.
--
-- OM FRÅNVARO: att registrera att en person är sjuk är en uppgift om den
-- personens hälsa. Tabellen har därför ingen plats för orsak eller
-- diagnos — bara en kategori, eftersom schemaläggaren behöver veta att
-- någon inte kommer, inte varför. Raden läses bara av personen själv och
-- av ledningen, aldrig av kollegorna.
--
-- Kör efter schema_part17_jour.sql.
-- ============================================================================

-- ============ 1. TILLGÄNGLIGHET OCH PASSÖNSKEMÅL ============
do $$
begin
  create type availability_kind as enum ('tillganglig', 'onskar', 'kan_inte');
exception when duplicate_object then null;
end $$;

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  from_time time,
  to_time time,
  kind availability_kind not null default 'tillganglig',
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, day, kind)
);

create index if not exists idx_availability_day on public.availability (tenant_id, day);

-- ============ 2. FRÅNVARO OCH ERSÄTTARE ============
do $$
begin
  create type absence_kind as enum ('sjuk', 'vab', 'ledig', 'annat');
exception when duplicate_object then null;
end $$;

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind absence_kind not null default 'annat',
  from_date date not null,
  to_date date not null,
  -- Medvetet INGEN orsaks- eller diagnosruta. Schemaläggaren behöver veta
  -- att någon inte kommer, inte varför.
  replacement_user_id uuid references public.profiles(id) on delete set null,
  reported_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

create index if not exists idx_absences_window on public.absences (tenant_id, from_date, to_date);

-- ============ 3. NOTIS VID SCHEMAÄNDRING ============
-- Ett pass som flyttas eller byter person utan att någon får veta är
-- värre än inget pass alls: då tror båda att det är täckt.
--
-- tenant_id tas från PASSET, inte från kolumndefaulten. Defaulten är
-- my_tenant(), som är null när ingen är inloggad — och då hade ett skript
-- eller ett cron-jobb som flyttar ett pass fallerat på not null.
create or replace function public.notify_shift_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nar text;
begin
  nar := to_char(new.starts_at at time zone 'Europe/Stockholm', 'DD/MM HH24:MI');

  -- Den som förlorar passet
  if tg_op = 'UPDATE' and old.user_id is not null
     and new.user_id is distinct from old.user_id then
    insert into public.notifications (user_id, title, body, tenant_id)
    values (old.user_id, 'Pass borttaget',
            'Passet ' || nar || ' är inte längre ditt.', new.tenant_id);
  end if;

  -- Den som får passet
  if new.user_id is not null
     and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    insert into public.notifications (user_id, title, body, tenant_id)
    values (new.user_id, 'Nytt pass',
            'Du är inbokad ' || nar || coalesce(' · ' || new.role_note, '') || '.', new.tenant_id);
  end if;

  -- Tiden ändrad på ett pass som redan har en person
  if tg_op = 'UPDATE' and new.user_id is not null
     and new.user_id is not distinct from old.user_id
     and (new.starts_at is distinct from old.starts_at
          or new.ends_at is distinct from old.ends_at) then
    insert into public.notifications (user_id, title, body, tenant_id)
    values (new.user_id, 'Passet har flyttats',
            'Ny tid: ' || nar || '.', new.tenant_id);
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_shift on public.shifts;
create trigger trg_notify_shift after insert or update on public.shifts
  for each row execute function public.notify_shift_change();

-- ============ 4. BEMANNINGSBRIST ============
-- Tre saker som alla betyder "ingen kommer": pass utan person, pass vars
-- person är frånvarande utan ersättare, och pass som ingen checkat in på
-- fast de borde ha börjat.
create or replace view public.staffing_gaps
with (security_invoker = on) as
select
  s.id as shift_id,
  s.tenant_id,
  s.starts_at,
  s.ends_at,
  s.role_note,
  s.location_type,
  s.location_id,
  case s.location_type
    when 'school' then (select x.name from public.schools x where x.id = s.location_id)
    when 'arena'  then (select x.name from public.arenas x where x.id = s.location_id)
    else '—'
  end as location_name,
  p.full_name as assigned_name,
  case
    when s.user_id is null then 'obemannat'
    when a.id is not null and a.replacement_user_id is null then 'franvarande utan ersattare'
    when s.starts_at < now() and s.checked_in_at is null and s.status <> 'checked_in'
      then 'ej incheckad'
  end as gap_kind
from public.shifts s
left join public.profiles p on p.id = s.user_id
left join public.absences a
       on a.user_id = s.user_id
      and s.starts_at::date between a.from_date and a.to_date
where s.ends_at > now() - interval '12 hours'
  and (
    s.user_id is null
    or (a.id is not null and a.replacement_user_id is null)
    or (s.starts_at < now() and s.checked_in_at is null and s.status <> 'checked_in')
  );

grant select on public.staffing_gaps to authenticated;

-- ============ 5. DIGITAL INTRODUKTION ============
create table if not exists public.onboarding_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  title text not null,
  body text not null default '',
  -- Tom lista = gäller alla roller
  roles app_role[] not null default '{}',
  sort_order int not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_done (
  item_id uuid not null references public.onboarding_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- Hur långt varje person kommit. Ledningen ser alla, var och en ser sig själv.
create or replace view public.onboarding_status
with (security_invoker = on) as
select
  p.id as user_id,
  p.tenant_id,
  p.full_name,
  p.role,
  count(i.id) filter (where i.required)                      as required_items,
  count(d.item_id) filter (where i.required)                 as done_items,
  count(i.id) filter (where i.required) = count(d.item_id) filter (where i.required) as complete
from public.profiles p
join public.onboarding_items i
  on i.tenant_id = p.tenant_id
 and (cardinality(i.roles) = 0 or p.role = any(i.roles))
left join public.onboarding_done d on d.item_id = i.id and d.user_id = p.id
group by p.id, p.tenant_id, p.full_name, p.role;

grant select on public.onboarding_status to authenticated;

-- ============ 6. BEHÖRIGHET ============
alter table public.availability enable row level security;
alter table public.absences enable row level security;
alter table public.onboarding_items enable row level security;
alter table public.onboarding_done enable row level security;

-- Tillgänglighet: var och en sköter sin egen, schemaläggaren ser alla
drop policy if exists "tillganglighet egen" on public.availability;
create policy "tillganglighet egen" on public.availability for all to authenticated
  using (user_id = auth.uid() or public.my_tier() >= 4)
  with check (user_id = auth.uid() or public.my_tier() >= 4);

-- Frånvaro: BARA personen själv och ledningen. Att en kollega kan se att
-- någon är sjukskriven är inte en driftfråga.
drop policy if exists "franvaro egen" on public.absences;
create policy "franvaro egen" on public.absences for all to authenticated
  using (user_id = auth.uid() or public.my_tier() >= 4)
  with check (user_id = auth.uid() or public.my_tier() >= 4);

drop policy if exists "intro läs" on public.onboarding_items;
create policy "intro läs" on public.onboarding_items for select to authenticated using (true);

drop policy if exists "intro skriv" on public.onboarding_items;
create policy "intro skriv" on public.onboarding_items for all to authenticated
  using (public.my_tier() >= 4) with check (public.my_tier() >= 4);

drop policy if exists "intro klar" on public.onboarding_done;
create policy "intro klar" on public.onboarding_done for all to authenticated
  using (user_id = auth.uid() or public.my_tier() >= 4)
  with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['availability','absences','onboarding_items','onboarding_done'] loop
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
  alter publication supabase_realtime add table public.absences;
exception when duplicate_object then null;
end $$;

-- ============ 7. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='absences')          as franvaro,
  (select count(*) from pg_views where schemaname='public'
    and viewname in ('staffing_gaps','onboarding_status'))          as vyer,
  (select count(*) from pg_trigger where tgname = 'trg_notify_shift') as notistrigger,
  (select count(*) from information_schema.columns
    where table_name='absences' and column_name in ('reason','diagnosis')) as ska_vara_noll;
