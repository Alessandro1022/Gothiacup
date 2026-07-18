-- TournamentOps · Del 4 · AI, säkerhet, inbjudningar, historik
-- Kör i Supabase SQL Editor EFTER schema.sql, schema_part2.sql och schema_part3.sql.

-- ============ RISKFLAGGNING AV MATCHER ============
-- grön = planvärd + domare räcker · gul = matchdelegat kopplas · röd = säkerhetsgruppen
create type risk_level as enum ('green','yellow','red');
alter table public.arena_matches
  add column risk_level risk_level not null default 'green',
  add column risk_note text;

-- ============ INBJUDNINGAR ============
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role app_role not null default 'volunteer',
  area_id uuid references public.areas(id) on delete set null,
  location_type location_type,
  location_id uuid,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.invites enable row level security;
create policy "invites admin" on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- När en inbjuden person loggar in första gången: applicera roll + scope automatiskt
create or replace function public.apply_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.invites
    where lower(email) = lower(new.email) and accepted_at is null
    order by created_at desc limit 1;
  if inv.id is not null then
    update public.profiles set role = inv.role where id = new.id;
    if inv.area_id is not null then
      insert into public.staff_scope (user_id, area_id) values (new.id, inv.area_id);
    elsif inv.location_type is not null and inv.location_id is not null then
      insert into public.staff_scope (user_id, location_type, location_id)
      values (new.id, inv.location_type, inv.location_id);
    end if;
    update public.invites set accepted_at = now() where id = inv.id;
  end if;
  return new;
end $$;

create trigger trg_apply_invite after insert on public.profiles
  for each row execute function public.apply_invite();

-- ============ AI-RAPPORTER ============
create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,          -- 'overview' | 'schools' | 'security' | 'matches'
  slot text not null,          -- 'morning' | 'evening' | 'manual'
  report_date date not null default (now() at time zone 'Europe/Stockholm')::date,
  body text not null,
  created_at timestamptz not null default now(),
  unique (kind, slot, report_date)
);
alter table public.ai_reports enable row level security;
create policy "ai läs" on public.ai_reports for select to authenticated
  using (public.my_tier() >= 2);
create policy "ai skriv" on public.ai_reports for all to authenticated
  using (public.my_tier() >= 3) with check (public.my_tier() >= 3);

-- ============ SÄKERHETSBILAR & RUTTER ============
create table public.security_cars (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  active boolean not null default true
);
insert into public.security_cars (label) values ('Bil 1'), ('Bil 2'), ('Bil 3'), ('Bil 4');

create table public.car_routes (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.security_cars(id) on delete cascade,
  route_date date not null default (now() at time zone 'Europe/Stockholm')::date,
  slot text not null,          -- 'morning' | 'evening' | 'manual'
  stops jsonb not null default '[]',  -- [{school_id, name, score, reasons: []}]
  created_at timestamptz not null default now(),
  unique (car_id, route_date, slot)
);
alter table public.security_cars enable row level security;
alter table public.car_routes enable row level security;
create policy "cars läs" on public.security_cars for select to authenticated using (true);
create policy "cars skriv" on public.security_cars for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());
create policy "rutter läs" on public.car_routes for select to authenticated
  using (public.my_tier() >= 2);
create policy "rutter skriv" on public.car_routes for all to authenticated
  using (public.my_tier() >= 3) with check (public.my_tier() >= 3);

-- ============ HISTORIK ============
-- Bredare audit: fler tabeller loggas
create trigger trg_audit_teams after insert or update or delete on public.team_assignments
  for each row execute function public.audit_trigger();
create trigger trg_audit_matches after insert or update or delete on public.arena_matches
  for each row execute function public.audit_trigger();
create trigger trg_audit_classrooms after insert or update or delete on public.classrooms
  for each row execute function public.audit_trigger();
create trigger trg_audit_issues after insert or update or delete on public.room_issues
  for each row execute function public.audit_trigger();
create trigger trg_audit_news after insert or update or delete on public.news_posts
  for each row execute function public.audit_trigger();
create trigger trg_audit_docs after insert or update or delete on public.documents
  for each row execute function public.audit_trigger();

-- Historik läsbar för koordinator+ (tidigare endast admin)
drop policy "audit läs" on public.audit_log;
create policy "audit läs" on public.audit_log for select to authenticated
  using (public.my_tier() >= 4);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.ai_reports;
alter publication supabase_realtime add table public.car_routes;
