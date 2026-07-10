-- TournamentOps · Del 3 · Enterprise
-- Kör i Supabase SQL Editor EFTER schema.sql och schema_part2.sql.

create type swap_status as enum ('pending','approved','rejected');

-- ============ RUNTIME WHITE-LABEL ============
create table public.event_settings (
  id int primary key default 1 check (id = 1),
  event_name text,
  primary_color text,
  updated_at timestamptz not null default now()
);
insert into public.event_settings (id) values (1);

-- ============ KRISLÄGE ============
create table public.crisis_state (
  id int primary key default 1 check (id = 1),
  active boolean not null default false,
  message text,
  activated_by uuid references public.profiles(id),
  activated_at timestamptz
);
insert into public.crisis_state (id) values (1);

-- ============ NYHETER ============
create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  pinned boolean not null default false,
  min_tier int not null default 1,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============ CHATT ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'global',   -- 'global' | 'leadership' | 'area:<uuid>'
  body text not null,
  sender uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============ DOKUMENT ============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  category text not null default 'Övrigt',
  min_tier int not null default 1,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============ INCIDENTKOMMENTARER ============
create table public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  body text not null,
  author uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============ PASSBYTEN ============
create table public.shift_swaps (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  note text,
  status swap_status not null default 'pending',
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ KOD-/QR-INCHECKNING ============
alter table public.shifts
  add column checkin_code text not null default encode(gen_random_bytes(4), 'hex');

-- ============ RADERA-POLICIES (Del 1-tabeller) ============
create policy "incidents radera" on public.incidents for delete to authenticated
  using (public.is_admin() or reported_by = auth.uid());
create policy "tasks radera" on public.tasks for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ============ RLS ============
alter table public.event_settings enable row level security;
alter table public.crisis_state enable row level security;
alter table public.news_posts enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.incident_comments enable row level security;
alter table public.shift_swaps enable row level security;

create policy "settings läs" on public.event_settings for select to authenticated using (true);
create policy "settings skriv" on public.event_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "kris läs" on public.crisis_state for select to authenticated using (true);
create policy "kris skriv" on public.crisis_state for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "nyheter läs" on public.news_posts for select to authenticated
  using (min_tier <= public.my_tier());
create policy "nyheter skapa" on public.news_posts for insert to authenticated
  with check (public.is_coordinator() and created_by = auth.uid());
create policy "nyheter ändra" on public.news_posts for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
create policy "nyheter radera" on public.news_posts for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- Kanalåtkomst: global = alla, leadership = tier>=4, area:<id> = scope på området
create or replace function public.can_use_channel(ch text) returns boolean
language sql stable security definer set search_path = public as $$
  select ch = 'global'
    or (ch = 'leadership' and public.my_tier() >= 4)
    or (ch like 'area:%' and (
      public.is_admin()
      or exists (select 1 from public.staff_scope s
                 where s.user_id = auth.uid() and s.area_id::text = split_part(ch, ':', 2))
    ))
$$;

create policy "chatt läs" on public.messages for select to authenticated
  using (public.can_use_channel(channel));
create policy "chatt skriv" on public.messages for insert to authenticated
  with check (public.can_use_channel(channel) and sender = auth.uid());
create policy "chatt radera" on public.messages for delete to authenticated
  using (public.is_admin() or sender = auth.uid());

create policy "dok läs" on public.documents for select to authenticated
  using (min_tier <= public.my_tier());
create policy "dok skriv" on public.documents for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

-- Kommentarer ärver incident-RLS via subquery
create policy "komm läs" on public.incident_comments for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_id));
create policy "komm skapa" on public.incident_comments for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.incidents i where i.id = incident_id));
create policy "komm radera" on public.incident_comments for delete to authenticated
  using (public.is_admin() or author = auth.uid());

create policy "byten läs" on public.shift_swaps for select to authenticated
  using (requested_by = auth.uid() or public.my_tier() >= 3);
create policy "byten skapa" on public.shift_swaps for insert to authenticated
  with check (requested_by = auth.uid());
create policy "byten besluta" on public.shift_swaps for update to authenticated
  using (public.my_tier() >= 3) with check (public.my_tier() >= 3);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.crisis_state;
alter publication supabase_realtime add table public.news_posts;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.incident_comments;
alter publication supabase_realtime add table public.shift_swaps;
alter publication supabase_realtime add table public.event_settings;

-- ============ SEED ============
insert into public.documents (name, url, category, min_tier) values
  ('Krisplan (mall)', 'https://example.com/krisplan.pdf', 'Säkerhet', 3),
  ('Volontärhandbok', 'https://example.com/handbok.pdf', 'Personal', 1);
insert into public.news_posts (title, body, pinned, min_tier, created_by)
select 'Välkommen till TournamentOps', 'Här publicerar ledningen driftinformation under turneringen.', true, 1, id
from public.profiles order by created_at limit 1;
