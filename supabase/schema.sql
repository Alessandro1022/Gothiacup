-- TournamentOps · Del 1 · Fundament
-- Kör i Supabase SQL Editor på ett färskt projekt.

create extension if not exists "pgcrypto";

-- ============ ENUMS ============
create type app_role as enum
  ('leadership','admin','coordinator','area_housing','area_arenas','school_staff','arena_staff','volunteer');
create type location_type as enum ('school','arena');
create type incident_severity as enum ('low','medium','high','critical');
create type incident_status as enum ('open','in_progress','resolved');
create type task_status as enum ('todo','in_progress','done');
create type task_priority as enum ('low','normal','high');

-- ============ TABELLER ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  role app_role not null default 'volunteer',
  language text not null default 'sv',
  created_at timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas(id) on delete set null,
  name text not null,
  address text,
  capacity int not null default 0,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);

create table public.arenas (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas(id) on delete set null,
  name text not null,
  address text,
  surface_count int not null default 1,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);

-- Scope: pekar på OMRÅDE *eller* enskild plats
create table public.staff_scope (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.areas(id) on delete cascade,
  location_type location_type,
  location_id uuid,
  created_at timestamptz not null default now(),
  check (area_id is not null or (location_type is not null and location_id is not null))
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  severity incident_severity not null default 'medium',
  status incident_status not null default 'open',
  location_type location_type,
  location_id uuid,
  reported_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'normal',
  assigned_to uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  location_type location_type,
  location_id uuid,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text not null,
  action text not null,
  actor uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

-- ============ HJÄLPFUNKTIONER (SECURITY DEFINER, ingen RLS-rekursion) ============
create or replace function public.auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.role_tier(r app_role) returns int
language sql immutable as $$
  select case r
    when 'leadership' then 6 when 'admin' then 5 when 'coordinator' then 4
    when 'area_housing' then 3 when 'area_arenas' then 3
    when 'school_staff' then 2 when 'arena_staff' then 2 else 1 end
$$;

create or replace function public.my_tier() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(public.role_tier(public.auth_role()), 0)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_tier() >= 5
$$;

create or replace function public.is_coordinator() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_tier() >= 4
$$;

create or replace function public.manages_area(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.staff_scope s where s.user_id = auth.uid() and s.area_id = a)
$$;

-- Sant om: platsen är direkt tilldelad, ELLER ligger i mitt område, ELLER jag är admin+
create or replace function public.has_scope(t location_type, lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.staff_scope s
               where s.user_id = auth.uid() and s.location_type = t and s.location_id = lid)
    or exists (
      select 1 from public.staff_scope s
      where s.user_id = auth.uid() and s.area_id is not null and s.area_id in (
        select area_id from public.schools where t = 'school' and id = lid
        union all
        select area_id from public.arenas  where t = 'arena'  and id = lid
      )
    )
$$;

-- Ny användare -> profil
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Skydd: bara admin+ får ändra roll
create or replace function public.protect_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Endast admin kan ändra roll';
  end if;
  return new;
end $$;

create trigger trg_protect_role
  before update on public.profiles
  for each row execute function public.protect_role_change();

-- Audit-logg
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, record_id, action, actor, changes)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, ''),
          tg_op, auth.uid(),
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger trg_audit_incidents after insert or update or delete on public.incidents
  for each row execute function public.audit_trigger();
create trigger trg_audit_tasks after insert or update or delete on public.tasks
  for each row execute function public.audit_trigger();
create trigger trg_audit_scope after insert or update or delete on public.staff_scope
  for each row execute function public.audit_trigger();

-- updated_at på tasks
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.schools enable row level security;
alter table public.arenas enable row level security;
alter table public.staff_scope enable row level security;
alter table public.incidents enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy "profiles läs" on public.profiles for select to authenticated using (true);
create policy "profiles egen uppdatering" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- struktur: läsbar för alla inloggade, skrivbar av admin+
create policy "areas läs" on public.areas for select to authenticated using (true);
create policy "areas skriv" on public.areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "schools läs" on public.schools for select to authenticated using (true);
create policy "schools skriv" on public.schools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "arenas läs" on public.arenas for select to authenticated using (true);
create policy "arenas skriv" on public.arenas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- staff_scope
create policy "scope läs" on public.staff_scope for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "scope skriv" on public.staff_scope for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- incidents
create policy "incidents läs" on public.incidents for select to authenticated
  using (
    public.is_admin()
    or reported_by = auth.uid()
    or assigned_to = auth.uid()
    or (location_id is not null and public.has_scope(location_type, location_id))
    or (location_id is null and public.my_tier() >= 3)
  );
create policy "incidents skapa" on public.incidents for insert to authenticated
  with check (reported_by = auth.uid());
create policy "incidents uppdatera" on public.incidents for update to authenticated
  using (
    public.is_admin()
    or reported_by = auth.uid()
    or assigned_to = auth.uid()
    or (location_id is not null and public.has_scope(location_type, location_id))
  );

-- tasks
create policy "tasks läs" on public.tasks for select to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or (location_id is not null and public.has_scope(location_type, location_id))
    or (location_id is null and public.my_tier() >= 3)
  );
create policy "tasks skapa" on public.tasks for insert to authenticated
  with check (created_by = auth.uid());
create policy "tasks uppdatera" on public.tasks for update to authenticated
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or (location_id is not null and public.has_scope(location_type, location_id))
  );

-- notifications
create policy "notiser läs" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notiser uppdatera" on public.notifications for update to authenticated
  using (user_id = auth.uid());
create policy "notiser skapa" on public.notifications for insert to authenticated
  with check (public.is_coordinator());

-- audit
create policy "audit läs" on public.audit_log for select to authenticated
  using (public.is_admin());

-- ============ REALTIME ============
alter publication supabase_realtime add table public.incidents;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.notifications;

-- ============ SEED (testdata) ============
insert into public.areas (name, description) values
  ('Område Centrum', 'Heden + centrala skolor'),
  ('Område Väster', 'Västra skolor och planer');

insert into public.schools (name, area_id, capacity, address)
select s.name, a.id, s.cap, s.addr from (values
  ('Hvitfeldtska gymnasiet', 'Område Centrum', 420, 'Rektorsgatan 2'),
  ('Schillerska gymnasiet', 'Område Centrum', 300, 'Vasagatan 19'),
  ('Frölundaskolan', 'Område Väster', 260, 'Frölunda'),
  ('Påvelundsskolan', 'Område Väster', 180, 'Påvelund')
) as s(name, area, cap, addr)
join public.areas a on a.name = s.area;

insert into public.arenas (name, area_id, surface_count, address)
select s.name, a.id, s.cnt, s.addr from (values
  ('Heden', 'Område Centrum', 12, 'Heden, Göteborg'),
  ('Slottsskogsvallen', 'Område Centrum', 4, 'Slottsskogen'),
  ('Ruddalens IP', 'Område Väster', 6, 'Ruddalen')
) as s(name, area, cnt, addr)
join public.areas a on a.name = s.area;
