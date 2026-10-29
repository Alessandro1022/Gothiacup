-- TournamentOps · Del 19 · Ärendedjup
-- ============================================================================
-- Etapp 4, tredje klustret. Det billigaste i hela planen: prioritet,
-- deadline och status FINNS redan på tasks — de saknades bara i
-- gränssnittet. Det som verkligen saknas är kommentarer, bilagor och
-- återkommande checklistor.
--
-- Kör efter schema_part18_bemanning.sql.
-- ============================================================================

-- ============ 1. KOMMENTARER PÅ UPPGIFTER ============
-- incident_comments finns sedan tidigare; uppgifter saknade motsvarigheten.
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  author uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments on public.task_comments (task_id, created_at);

-- ============ 2. BILAGOR ============
-- En rad per fil. Själva filen ligger i Supabase Storage; här sparas bara
-- sökvägen, så att behörigheten följer ärendet och inte filen.
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  -- Vad bilagan hör till. Samma mönster som incidents location_type.
  parent_type text not null check (parent_type in ('task', 'incident', 'room_issue', 'message')),
  parent_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null default '',
  size_bytes int,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_parent on public.attachments (parent_type, parent_id);

-- ============ 3. ÅTERKOMMANDE CHECKLISTOR ============
-- checklist_templates finns. Det som saknades är schemat: att en lista ska
-- köras varje dag på varje boende, och att man kan se vilka som inte gjorts.
do $$
begin
  create type checklist_cadence as enum ('daglig', 'varje_pass', 'veckovis', 'engang');
exception when duplicate_object then null;
end $$;

alter table public.checklist_templates
  add column if not exists tenant_id uuid default public.my_tenant()
    references public.tenants(id) on delete cascade,
  add column if not exists cadence checklist_cadence not null default 'engang',
  add column if not exists active boolean not null default true,
  add column if not exists due_time time;          -- t.ex. nattronden 23:00

update public.checklist_templates
   set tenant_id = (select id from public.tenants where slug = 'gothia-cup')
 where tenant_id is null;

-- Vilka körningar som SKULLE ha gjorts idag, och vilka som faktiskt gjorts.
-- En daglig lista gäller varje aktiv plats av rätt typ.
create or replace view public.checklist_due_today
with (security_invoker = on) as
with platser as (
  select 'school'::location_type as location_type, s.id as location_id,
         s.name as location_name, s.tenant_id
  from public.schools s
  union all
  select 'arena'::location_type, a.id, a.name, a.tenant_id
  from public.arenas a
)
select
  t.id            as template_id,
  t.tenant_id,
  t.name          as template_name,
  t.cadence,
  t.due_time,
  p.location_type,
  p.location_id,
  p.location_name,
  r.id            as run_id,
  r.created_at    as done_at
from public.checklist_templates t
join platser p
  on p.location_type = t.location_type
 and p.tenant_id = t.tenant_id
left join public.checklist_runs r
  on r.template_id = t.id
 and r.location_id = p.location_id
 and r.created_at::date = (now() at time zone 'Europe/Stockholm')::date
where t.active and t.cadence in ('daglig', 'varje_pass');

grant select on public.checklist_due_today to authenticated;

-- ============ 4. BEHÖRIGHET ============
alter table public.task_comments enable row level security;
alter table public.attachments enable row level security;

-- Kommentarer följer uppgiften: ser du uppgiften ser du kommentarerna.
drop policy if exists "uppgiftskommentar läs" on public.task_comments;
create policy "uppgiftskommentar läs" on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

drop policy if exists "uppgiftskommentar skapa" on public.task_comments;
create policy "uppgiftskommentar skapa" on public.task_comments for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

-- Egen kommentar får tas bort av skribenten eller av ledningen
drop policy if exists "uppgiftskommentar radera" on public.task_comments;
create policy "uppgiftskommentar radera" on public.task_comments for delete to authenticated
  using (author = auth.uid() or public.my_tier() >= 5);

drop policy if exists "bilaga läs" on public.attachments;
create policy "bilaga läs" on public.attachments for select to authenticated using (true);

drop policy if exists "bilaga skapa" on public.attachments;
create policy "bilaga skapa" on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists "bilaga radera" on public.attachments;
create policy "bilaga radera" on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.my_tier() >= 5);

do $$
declare t text;
begin
  foreach t in array array['task_comments', 'attachments', 'checklist_templates'] loop
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
  alter publication supabase_realtime add table public.task_comments;
exception when duplicate_object then null;
end $$;

-- ============ 5. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='task_comments')   as kommentarer,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='attachments')     as bilagor,
  (select count(*) from pg_views
    where schemaname='public' and viewname='checklist_due_today') as checklistvy,
  (select count(*) from information_schema.columns
    where table_name='tasks' and column_name in ('priority','due_at','status')) as fanns_redan;
