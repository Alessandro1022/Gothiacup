-- TournamentOps · Del 2 · Områdesdrift
-- Kör i Supabase SQL Editor EFTER schema.sql (Del 1).

-- ============ ENUMS ============
create type team_status as enum ('expected','checked_in','checked_out');
create type shift_status as enum ('planned','checked_in','checked_out','missed');
create type issue_status as enum ('open','in_progress','resolved');
create type key_status as enum ('in','out','lost');
create type match_status as enum ('scheduled','ongoing','finished','cancelled');
create type run_status as enum ('open','done');

-- ============ TABELLER ============
create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  capacity int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.team_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  team_name text not null,
  country text,
  group_size int not null default 0,
  contact_name text,
  contact_phone text,
  status team_status not null default 'expected',
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.room_keys (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,
  status key_status not null default 'in',
  holder_name text,
  updated_at timestamptz not null default now()
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  location_type location_type not null,
  location_id uuid not null,
  name text not null,
  quantity int not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  location_type location_type,
  location_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  role_note text,
  status shift_status not null default 'planned',
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.room_issues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  title text not null,
  description text,
  status issue_status not null default 'open',
  reported_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.night_rounds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  all_ok boolean not null default true,
  notes text,
  performed_by uuid not null references public.profiles(id),
  performed_at timestamptz not null default now()
);

create table public.arena_matches (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  surface_label text not null,
  home_team text not null,
  away_team text not null,
  category text,
  starts_at timestamptz not null,
  status match_status not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table public.security_logs (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  entry text not null,
  severity incident_severity not null default 'low',
  logged_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.crowd_counts (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  count int not null,
  noted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type location_type not null,
  items jsonb not null default '[]'::jsonb,  -- ["punkt 1","punkt 2"]
  created_at timestamptz not null default now()
);

create table public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.checklist_templates(id) on delete set null,
  template_name text not null default '',
  location_type location_type not null,
  location_id uuid not null,
  status run_status not null default 'open',
  started_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.checklist_runs(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  done_by uuid references public.profiles(id),
  done_at timestamptz,
  sort int not null default 0
);

-- ============ TRIGGERS ============
-- room_keys har updated_at: egen touch-funktion
create or replace function public.touch_updated_at_keys() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_keys_touch before update on public.room_keys
  for each row execute function public.touch_updated_at_keys();

create trigger trg_audit_shifts after insert or update or delete on public.shifts
  for each row execute function public.audit_trigger();
create trigger trg_audit_keys after insert or update or delete on public.room_keys
  for each row execute function public.audit_trigger();

-- ============ RLS ============
alter table public.classrooms enable row level security;
alter table public.team_assignments enable row level security;
alter table public.room_keys enable row level security;
alter table public.materials enable row level security;
alter table public.shifts enable row level security;
alter table public.room_issues enable row level security;
alter table public.night_rounds enable row level security;
alter table public.arena_matches enable row level security;
alter table public.security_logs enable row level security;
alter table public.crowd_counts enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_runs enable row level security;
alter table public.checklist_items enable row level security;

-- Skol-scopade tabeller: allt via has_scope('school', school_id)
create policy "classrooms scope" on public.classrooms for all to authenticated
  using (public.has_scope('school', school_id)) with check (public.has_scope('school', school_id));
create policy "teams scope" on public.team_assignments for all to authenticated
  using (public.has_scope('school', school_id)) with check (public.has_scope('school', school_id));
create policy "keys scope" on public.room_keys for all to authenticated
  using (public.has_scope('school', school_id)) with check (public.has_scope('school', school_id));
create policy "room_issues scope" on public.room_issues for all to authenticated
  using (public.has_scope('school', school_id)) with check (public.has_scope('school', school_id));
create policy "rounds scope" on public.night_rounds for all to authenticated
  using (public.has_scope('school', school_id)) with check (public.has_scope('school', school_id));

-- Arena-scopade tabeller
create policy "matches scope" on public.arena_matches for all to authenticated
  using (public.has_scope('arena', arena_id)) with check (public.has_scope('arena', arena_id));
create policy "seclog scope" on public.security_logs for all to authenticated
  using (public.has_scope('arena', arena_id)) with check (public.has_scope('arena', arena_id));
create policy "crowd scope" on public.crowd_counts for all to authenticated
  using (public.has_scope('arena', arena_id)) with check (public.has_scope('arena', arena_id));

-- Material: valfri platstyp
create policy "materials scope" on public.materials for all to authenticated
  using (public.has_scope(location_type, location_id)) with check (public.has_scope(location_type, location_id));

-- Pass: egna + scope; skapa kräver tier>=3
create policy "shifts egna läs" on public.shifts for select to authenticated
  using (user_id = auth.uid());
create policy "shifts scope" on public.shifts for select to authenticated
  using (location_id is not null and public.has_scope(location_type, location_id));
create policy "shifts skapa" on public.shifts for insert to authenticated
  with check (public.my_tier() >= 3 and created_by = auth.uid());
create policy "shifts egen check" on public.shifts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shifts mgr uppdatera" on public.shifts for update to authenticated
  using (location_id is not null and public.has_scope(location_type, location_id));
create policy "shifts mgr radera" on public.shifts for delete to authenticated
  using (public.is_coordinator() or (location_id is not null and public.has_scope(location_type, location_id)));

-- Checklistmallar: läs alla, skriv koordinator+
create policy "tmpl läs" on public.checklist_templates for select to authenticated using (true);
create policy "tmpl skriv" on public.checklist_templates for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

-- Checklist-körningar + punkter: via platsens scope
create policy "runs scope" on public.checklist_runs for all to authenticated
  using (public.has_scope(location_type, location_id)) with check (public.has_scope(location_type, location_id));
create policy "items scope" on public.checklist_items for all to authenticated
  using (exists (select 1 from public.checklist_runs r
                 where r.id = run_id and public.has_scope(r.location_type, r.location_id)))
  with check (exists (select 1 from public.checklist_runs r
                 where r.id = run_id and public.has_scope(r.location_type, r.location_id)));

-- ============ REALTIME ============
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.team_assignments;
alter publication supabase_realtime add table public.room_issues;
alter publication supabase_realtime add table public.security_logs;
alter publication supabase_realtime add table public.crowd_counts;
alter publication supabase_realtime add table public.checklist_items;

-- ============ SEED ============
insert into public.classrooms (school_id, name, capacity)
select id, r.name, r.cap from public.schools s
cross join (values ('Sal 101', 28), ('Sal 102', 24), ('Aulan', 60)) as r(name, cap)
where s.name = 'Hvitfeldtska gymnasiet';

insert into public.room_keys (school_id, label)
select id, k from public.schools s
cross join (values ('Huvudentré'), ('Gympasal'), ('Sal 101')) as t(k)
where s.name = 'Hvitfeldtska gymnasiet';

insert into public.arena_matches (arena_id, surface_label, home_team, away_team, category, starts_at)
select id, m.surf, m.h, m.a, m.cat, now() + m.off from public.arenas ar
cross join (values
  ('Plan 3', 'IFK Göteborg P14', 'Boca Juniors P14', 'B14', interval '2 hours'),
  ('Plan 7', 'Häcken F16', 'Nagoya FC F16', 'G16', interval '4 hours')
) as m(surf, h, a, cat, off)
where ar.name = 'Heden';

insert into public.checklist_templates (name, location_type, items) values
  ('Öppning spelyta', 'arena', '["Mål förankrade","Hörnflaggor ute","Sjukvårdsväska på plats","Sopkärl tömda","Linjer OK"]'::jsonb),
  ('Morgonrond skola', 'school', '["Nödutgångar fria","Kök städat","Duschar OK","Brandsläckare på plats"]'::jsonb);
