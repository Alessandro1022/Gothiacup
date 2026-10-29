-- TournamentOps · Del 21 · Chattdjup
-- ============================================================================
-- Etapp 4, sista klustret. messages finns med ett channel-fält som är en
-- fri sträng ('global', 'leadership', 'area:<uuid>'). Det funkar så länge
-- alla kanaler är öppna, men faller sönder så fort det ska finnas privata
-- samtal: vem får läsa 'dm:abc'? En fri sträng kan inte svara på det.
--
-- Därför en riktig kanaltabell med medlemmar. De gamla meddelandena
-- flyttas över så att historiken följer med.
--
-- PUSHNOTISER: kräver VAPID-nycklar som bara du kan generera. Tabellen för
-- prenumerationer ligger här, men själva utskicket aktiveras när nycklarna
-- finns i miljövariablerna.
--
-- Kör efter schema_part20_matcher.sql.
-- ============================================================================

-- ============ 1. KANALER ============
do $$
begin
  create type channel_kind as enum ('global', 'grupp', 'plats', 'direkt', 'lagledare');
exception when duplicate_object then null;
end $$;

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  kind channel_kind not null default 'grupp',
  name text not null default '',
  -- Öppen kanal: alla i turneringen får läsa. Annars styr medlemskapet.
  is_open boolean not null default false,
  min_tier int not null default 1,
  -- Platskanaler knyts till ett boende eller en spelplats
  location_type location_type,
  location_id uuid,
  -- Lagledarkanal knyts till laget
  team_assignment_id uuid references public.team_assignments(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_channels_tenant on public.channels (tenant_id, kind);

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index if not exists idx_channel_members_user on public.channel_members (user_id);

-- ============ 2. MEDDELANDEN FÅR EN RIKTIG KANAL ============
alter table public.messages
  add column if not exists tenant_id uuid default public.my_tenant()
    references public.tenants(id) on delete cascade,
  add column if not exists channel_id uuid references public.channels(id) on delete cascade,
  add column if not exists priority boolean not null default false,  -- driftmeddelande
  add column if not exists reply_to uuid references public.messages(id) on delete set null,
  add column if not exists task_id uuid references public.tasks(id) on delete set null,
  add column if not exists translated_body text not null default '',
  add column if not exists translated_to text not null default '';

update public.messages
   set tenant_id = (select id from public.tenants where slug = 'gothia-cup')
 where tenant_id is null;

-- Flytta de gamla strängkanalerna till riktiga kanaler, så historiken
-- följer med i stället för att bli oläsbar.
do $$
declare
  t record;
  ch uuid;
begin
  for t in select id from public.tenants loop
    insert into public.channels (tenant_id, kind, name, is_open, min_tier)
    values (t.id, 'global', 'Alla', true, 1)
    returning id into ch;

    update public.messages m set channel_id = ch
     where m.tenant_id = t.id and m.channel = 'global' and m.channel_id is null;

    insert into public.channels (tenant_id, kind, name, is_open, min_tier)
    values (t.id, 'grupp', 'Ledning', true, 4)
    returning id into ch;

    update public.messages m set channel_id = ch
     where m.tenant_id = t.id and m.channel = 'leadership' and m.channel_id is null;
  end loop;
end $$;

create index if not exists idx_messages_channel
  on public.messages (channel_id, created_at desc);

-- ============ 3. VEM FÅR LÄSA VAD ============
-- En funktion i stället för upprepad logik i varje policy: öppen kanal med
-- tillräcklig behörighet, eller medlemskap. Direktmeddelanden är ALDRIG
-- öppna, oavsett tier — ledning ska inte kunna läsa personalens privata
-- samtal bara för att de står högre i organisationen.
create or replace function public.can_read_channel(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channels c
    where c.id = ch
      and c.tenant_id = public.my_tenant()
      and (
        (c.is_open and c.kind <> 'direkt' and public.my_tier() >= c.min_tier)
        or exists (
          select 1 from public.channel_members m
          where m.channel_id = c.id and m.user_id = auth.uid()
        )
      )
  )
$$;

-- ============ 4. OLÄSTA ============
create or replace view public.channel_unread
with (security_invoker = on) as
select
  c.id as channel_id,
  c.tenant_id,
  c.kind,
  c.name,
  c.is_open,
  m.user_id,
  count(msg.id) filter (
    where m.last_read_at is null or msg.created_at > m.last_read_at
  ) as unread,
  max(msg.created_at) as last_message_at
from public.channels c
join public.channel_members m on m.channel_id = c.id
left join public.messages msg on msg.channel_id = c.id
group by c.id, c.tenant_id, c.kind, c.name, c.is_open, m.user_id;

grant select on public.channel_unread to authenticated;

-- ============ 5. PUSHPRENUMERATIONER ============
-- Tabellen ligger här; utskicket aktiveras när VAPID-nycklarna finns.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 6. BEHÖRIGHET ============
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "kanal läs" on public.channels;
create policy "kanal läs" on public.channels for select to authenticated
  using (public.can_read_channel(id));

drop policy if exists "kanal skapa" on public.channels;
create policy "kanal skapa" on public.channels for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "kanal andra" on public.channels;
create policy "kanal andra" on public.channels for update to authenticated
  using (created_by = auth.uid() or public.my_tier() >= 4);

drop policy if exists "medlem läs" on public.channel_members;
create policy "medlem läs" on public.channel_members for select to authenticated
  using (user_id = auth.uid() or public.can_read_channel(channel_id));

drop policy if exists "medlem skriv" on public.channel_members;
create policy "medlem skriv" on public.channel_members for all to authenticated
  using (user_id = auth.uid() or public.my_tier() >= 4)
  with check (user_id = auth.uid() or public.my_tier() >= 4);

-- Meddelanden: gamla policyn släpptes på tier. Nu styr kanalen.
drop policy if exists "chatt läs" on public.messages;
create policy "chatt läs" on public.messages for select to authenticated
  using (channel_id is null or public.can_read_channel(channel_id));

drop policy if exists "chatt skriv" on public.messages;
create policy "chatt skriv" on public.messages for insert to authenticated
  with check (sender = auth.uid()
              and (channel_id is null or public.can_read_channel(channel_id)));

drop policy if exists "push egen" on public.push_subscriptions;
create policy "push egen" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['channels','channel_members','messages','push_subscriptions'] loop
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
  alter publication supabase_realtime add table public.channels;
exception when duplicate_object then null;
end $$;

-- ============ 7. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='channels')            as kanaler,
  (select count(*) from public.channels)                              as skapade_kanaler,
  (select count(*) from public.messages where channel_id is null)     as omigrerade_kvar,
  (select count(*) from pg_views
    where schemaname='public' and viewname='channel_unread')          as olastvy;
