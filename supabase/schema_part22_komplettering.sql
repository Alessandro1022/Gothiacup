-- TournamentOps · Del 22 · Komplettering av etapp 2–4
-- ============================================================================
-- Rättar det som klicktesterna hittade när gränssnittet för del 13–21 byggdes
-- klart: hål i behörigheter och beräkningar. Inga nya moduler. Det enda nya
-- är lagringen för bilagor (avsnitt 7) och läst-markeringen i chatten
-- (avsnitt 8).
--
-- Kör efter schema_part21_chatt.sql. Går att köra flera gånger.
-- ============================================================================

-- ============ 0. FÖRKONTROLL ============
-- Saknas del 17–21 blir felen här obegripliga. Säg det rakt ut i stället.
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'channels') then
    raise exception 'Kör del 16, 17 och 18–21 först (tops_del16_ekonomi.sql, tops_del17_jour.sql, tops_del18-21.sql).';
  end if;
end $$;

-- ============ 1. PASS UTAN PLATS SYNS FÖR LEDNINGEN ============
-- Pass utan plats – säkerhetsbilarnas rondering, en springare – syntes bara
-- för den som hade passet. Läspolicyn krävde en plats att ha behörighet
-- till, så koordinatorer och ledning såg dem inte: inte i schemat, inte i
-- bemanningsbristerna och inte i säkerhet per område.
drop policy if exists "shifts ledning" on public.shifts;
create policy "shifts ledning" on public.shifts for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

-- ============ 2. TABELLEN RÄKNAR ALLA MATCHER ============
-- group_standings ärvde behörigheten från matcherna, och en match syns bara
-- för den som har behörighet till spelplatsen. En planvärd på en plan såg
-- därför en tabell byggd bara på den planens matcher – fel poäng i varje
-- grupp som spelar på flera planer.
--
-- Resultat är inte känsliga, så vyn läser nu alla matcher, men bara i den
-- egna turneringen. Därför utan security_invoker, med flit, och med
-- turneringsfiltret skrivet i vyn i stället.
drop view if exists public.group_standings;
create view public.group_standings as
with spelade as (
  select
    m.tenant_id, m.group_name, m.category,
    m.home_team as team,
    case when m.walkover_team = m.home_team then 0
         when m.walkover_team = m.away_team then 3
         else m.home_score end as gf,
    case when m.walkover_team = m.home_team then 3
         when m.walkover_team = m.away_team then 0
         else m.away_score end as ga
  from public.arena_matches m
  where m.tenant_id = public.my_tenant()
    and m.status = 'finished'
    and (m.walkover_team <> '' or (m.home_score is not null and m.away_score is not null))

  union all

  select
    m.tenant_id, m.group_name, m.category,
    m.away_team,
    case when m.walkover_team = m.away_team then 0
         when m.walkover_team = m.home_team then 3
         else m.away_score end,
    case when m.walkover_team = m.away_team then 3
         when m.walkover_team = m.home_team then 0
         else m.home_score end
  from public.arena_matches m
  where m.tenant_id = public.my_tenant()
    and m.status = 'finished'
    and (m.walkover_team <> '' or (m.home_score is not null and m.away_score is not null))
)
select
  tenant_id, group_name, category, team,
  count(*)                                   as played,
  count(*) filter (where gf > ga)            as won,
  count(*) filter (where gf = ga)            as drawn,
  count(*) filter (where gf < ga)            as lost,
  sum(gf)                                    as goals_for,
  sum(ga)                                    as goals_against,
  sum(gf) - sum(ga)                          as goal_diff,
  count(*) filter (where gf > ga) * 3
    + count(*) filter (where gf = ga)        as points
from spelade
where group_name <> ''
group by tenant_id, group_name, category, team;

revoke all on public.group_standings from anon, public;
grant select on public.group_standings to authenticated;

-- ============ 3. MATCHER: LEDNINGEN OCH DOMAREN SER DEM ============
-- Matcher syntes bara för den med behörighet till spelplatsen. Koordinatorn
-- som gör domarschemat såg därför inte alla matcher, och en domare med
-- konto såg inte sina egna.
drop policy if exists "matcher ledning läs" on public.arena_matches;
create policy "matcher ledning läs" on public.arena_matches for select to authenticated
  using (public.is_coordinator());

drop policy if exists "matcher domare läs" on public.arena_matches;
create policy "matcher domare läs" on public.arena_matches for select to authenticated
  using (exists (
    select 1 from public.referees r
    where r.user_id = auth.uid()
      and r.id in (arena_matches.referee_id, arena_matches.referee_2_id)
  ));

-- ============ 4. PERSONALKOSTNAD FRÅN PASSEN ============
-- role_rates fanns sedan del 16 men användes aldrig, så personalposten i
-- ekonomin stod alltid på noll. Nu bokas kostnaden när ett pass checkas ut:
-- timmar gånger rollens timpris. Per ROLL, aldrig per person, och
-- beskrivningen nämner rollen, inte namnet.
--
-- Ändras ett timpris räknas rollens redan avslutade pass om, så att den som
-- sätter priserna efter att turneringen börjat inte får en tom personalpost.
create or replace function public.role_label(r app_role) returns text
language sql immutable as $$
  select case r::text
    when 'leadership' then 'Ledning'        when 'admin' then 'Admin'
    when 'coordinator' then 'Koordinator'   when 'area_housing' then 'Områdesansvarig boende'
    when 'area_arenas' then 'Områdesansvarig planer'
    when 'school_staff' then 'Boendevärd'   when 'arena_staff' then 'Planvärd'
    when 'volunteer' then 'Volontär'        when 'security_lead' then 'Säkerhetsansvarig'
    when 'security_staff' then 'Säkerhetspersonal'
    when 'transport_staff' then 'Transport' when 'food_staff' then 'Måltider'
    when 'stock_staff' then 'Lager'         when 'finance' then 'Ekonomi'
    when 'interpreter' then 'Tolk'          when 'medic' then 'Sjukvård'
    else r::text end
$$;

create or replace function public.book_shift_cost(sid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s record;
  roll app_role;
  taxa numeric(8,2);
  timmar numeric;
  slut timestamptz;
begin
  select * into s from public.shifts where id = sid;

  -- Inget avslutat pass med en person: ingen kostnad. Tar också bort en
  -- tidigare bokning om passet backats eller bytt person till ingen.
  if s.id is null or s.status <> 'checked_out' or s.user_id is null then
    delete from public.cost_entries where source_table = 'shifts' and source_id = sid;
    return;
  end if;

  select p.role into roll from public.profiles p where p.id = s.user_id;
  select rr.hourly_rate into taxa from public.role_rates rr
   where rr.tenant_id = s.tenant_id and rr.role = roll;

  slut := coalesce(s.checked_out_at, s.ends_at);
  timmar := greatest(extract(epoch from (slut - coalesce(s.checked_in_at, s.starts_at))) / 3600.0, 0);

  if coalesce(taxa, 0) = 0 or timmar = 0 then
    delete from public.cost_entries where source_table = 'shifts' and source_id = sid;
    return;
  end if;

  insert into public.cost_entries
    (tenant_id, category, amount, entry_date, description, source_table, source_id)
  values
    (s.tenant_id, 'personal', round(timmar * taxa, 2),
     (slut at time zone 'Europe/Stockholm')::date,
     'Pass · ' || public.role_label(roll) || ' · ' || replace(round(timmar, 1)::text, '.', ',') || ' h',
     'shifts', s.id)
  on conflict (source_table, source_id) where source_id is not null
  do update set amount = excluded.amount, entry_date = excluded.entry_date,
                description = excluded.description;
end $$;

revoke all on function public.book_shift_cost(uuid) from public, anon, authenticated;

create or replace function public.cost_from_shift() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.cost_entries where source_table = 'shifts' and source_id = old.id;
    return old;
  end if;
  perform public.book_shift_cost(new.id);
  return new;
end $$;

drop trigger if exists trg_cost_shift on public.shifts;
create trigger trg_cost_shift after insert or update or delete on public.shifts
  for each row execute function public.cost_from_shift();

create or replace function public.rebook_role_costs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.book_shift_cost(s.id)
  from public.shifts s
  join public.profiles p on p.id = s.user_id
  where s.tenant_id = new.tenant_id and p.role = new.role and s.status = 'checked_out';
  return new;
end $$;

drop trigger if exists trg_rebook_role on public.role_rates;
create trigger trg_rebook_role after insert or update on public.role_rates
  for each row execute function public.rebook_role_costs();

-- ============ 5. MÅLTIDER SER ALLA LAG ============
-- Prognosen och lagen läses genom lagens behörighet, som följer boendet.
-- Matpersonal har sällan behörighet till boenden, så för dem var prognosen
-- tom och det fanns inga lag att ge måltidsrättigheter. Vyerna läser nu
-- alla lag i turneringen, men bara för den som har måltidsmodulen, och
-- bara lagnamn och datum – inga kontaktuppgifter.
create or replace view public.meal_teams as
select
  ta.id, ta.tenant_id, ta.team_name, ta.school_id, s.name as school_name,
  ta.arrival_date, ta.departure_date, ta.status
from public.team_assignments ta
join public.schools s on s.id = ta.school_id
where ta.tenant_id = public.my_tenant()
  and public.can_module('meals');

revoke all on public.meal_teams from anon, public;
grant select on public.meal_teams to authenticated;

-- Läser lagen och deltagarna direkt ur tabellerna. Genom team_roster_stats
-- hade lagens behörighet följt med in igen: en vy som ägaren kör
-- (security_invoker = false) släpper inte behörigheten för en vy längre in
-- som själv kör som den som frågar.
create or replace view public.meal_forecast
with (security_invoker = false) as
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
join public.team_assignments ta on ta.id = e.team_assignment_id
cross join lateral (
  select count(*) as registered,
         count(*) filter (where p.checked_in_at is not null) as checked_in
  from public.participants p
  where p.team_assignment_id = ta.id
) r
cross join lateral (
  select generate_series(
    greatest(coalesce(e.from_date, ta.arrival_date, current_date), coalesce(ta.arrival_date, current_date)),
    least(coalesce(e.to_date, ta.departure_date, current_date), coalesce(ta.departure_date, current_date)),
    interval '1 day'
  )::date as service_date
) d
where e.tenant_id = public.my_tenant()
  and public.can_module('meals')
group by e.tenant_id, e.hall_id, h.name, d.service_date, e.meal;

revoke all on public.meal_forecast from anon, public;
grant select on public.meal_forecast to authenticated;

-- Avprickade per matsal, dag och mål, även när inget måltidspass är upplagt.
-- Annars visade dagsvyn noll avprickade fast korten redan lästs av.
create or replace view public.meal_checkin_counts
with (security_invoker = on) as
select tenant_id, hall_id, service_date, meal, count(*)::int as checked_in
from public.meal_checkins
group by tenant_id, hall_id, service_date, meal;

revoke all on public.meal_checkin_counts from anon, public;
grant select on public.meal_checkin_counts to authenticated;

-- ============ 6. CHECKLISTOR: STATUS OCH LEDNINGENS ÖVERBLICK ============
-- Dagens checklistor visar nu om körningen är klar eller bara påbörjad, och
-- räknar dagen i svensk tid. Förut jämfördes datumet i serverns tidszon,
-- så en runda vid midnatt kunde hamna på fel dag. Flera körningar samma
-- dag gav dessutom dubbla rader.
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
  r.created_at    as done_at,
  r.status        as run_status,
  r.completed_at
from public.checklist_templates t
join platser p
  on p.location_type = t.location_type
 and p.tenant_id = t.tenant_id
left join lateral (
  select x.id, x.created_at, x.status, x.completed_at
  from public.checklist_runs x
  where x.template_id = t.id
    and x.location_id = p.location_id
    and (x.created_at at time zone 'Europe/Stockholm')::date = (now() at time zone 'Europe/Stockholm')::date
  order by (x.status = 'done') desc, x.created_at desc
  limit 1
) r on true
where t.active and t.cadence in ('daglig', 'varje_pass');

grant select on public.checklist_due_today to authenticated;

-- Ledningen ser alla körningar, inte bara på platser de har behörighet
-- till – annars stod varje plats utanför deras område som ej gjord.
drop policy if exists "runs ledning läs" on public.checklist_runs;
create policy "runs ledning läs" on public.checklist_runs for select to authenticated
  using (public.is_coordinator());

drop policy if exists "items ledning läs" on public.checklist_items;
create policy "items ledning läs" on public.checklist_items for select to authenticated
  using (public.is_coordinator());

-- ============ 7. KOMMENTARER OCH BILAGOR ============
-- En kommentar ska bara kunna skrivas i eget namn.
drop policy if exists "uppgiftskommentar skapa" on public.task_comments;
create policy "uppgiftskommentar skapa" on public.task_comments for insert to authenticated
  with check (author = auth.uid()
              and exists (select 1 from public.tasks t where t.id = task_comments.task_id));

-- Bilagor följer det de hör till. Se du ärendet ser du bilagan, annars
-- inte. Bilder i ett direktmeddelande blir därmed lika privata som
-- meddelandet. Funktionen körs som den som frågar, så varje tabells egen
-- behörighet gäller.
create or replace function public.can_see_parent(t text, pid uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select case t
    when 'task'       then exists (select 1 from public.tasks       where id = pid)
    when 'incident'   then exists (select 1 from public.incidents   where id = pid)
    when 'room_issue' then exists (select 1 from public.room_issues where id = pid)
    when 'message'    then exists (select 1 from public.messages    where id = pid)
    else false
  end
$$;

drop policy if exists "bilaga läs" on public.attachments;
create policy "bilaga läs" on public.attachments for select to authenticated
  using (public.can_see_parent(parent_type, parent_id));

-- I chatten får man bara bifoga till sina egna meddelanden, annars kan en
-- bild hamna under någon annans namn.
drop policy if exists "bilaga skapa" on public.attachments;
create policy "bilaga skapa" on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid()
              and public.can_see_parent(parent_type, parent_id)
              and (parent_type <> 'message'
                   or exists (select 1 from public.messages m
                              where m.id = attachments.parent_id and m.sender = auth.uid())));

drop policy if exists "bilaga radera" on public.attachments;
create policy "bilaga radera" on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.my_tier() >= 5);

-- Filerna i Supabase Storage. Privat hink: inget går att nå med en öppen
-- länk. En fil får laddas upp bara till en sökväg som först registrerats som
-- bilaga av samma person, och läsas av den som ser bilagan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bilagor', 'bilagor', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bilagor läs" on storage.objects;
create policy "bilagor läs" on storage.objects for select to authenticated
  using (bucket_id = 'bilagor'
         and exists (select 1 from public.attachments a where a.storage_path = objects.name));

drop policy if exists "bilagor ladda upp" on storage.objects;
create policy "bilagor ladda upp" on storage.objects for insert to authenticated
  with check (bucket_id = 'bilagor'
              and exists (select 1 from public.attachments a
                          where a.storage_path = objects.name and a.uploaded_by = auth.uid()));

drop policy if exists "bilagor radera" on storage.objects;
create policy "bilagor radera" on storage.objects for delete to authenticated
  using (bucket_id = 'bilagor'
         and exists (select 1 from public.attachments a
                     where a.storage_path = objects.name
                       and (a.uploaded_by = auth.uid() or public.my_tier() >= 5)));

-- ============ 8. CHATT: KANALER, MEDLEMMAR OCH OLÄSTA ============
-- Klicktesterna hittade fyra fel i del 21:
--  a) Ingen kunde starta ett direktmeddelande. Den nya kanalen läses tillbaka
--     direkt, men läspolicyn krävde medlemskap, och medlemmarna läggs till
--     först efteråt.
--  b) Bara ledningen fick lägga till den andra personen i samtalet.
--  c) Vem som helst kunde lägga till sig själv i vilken kanal som helst, och
--     ledningen kunde lägga till sig i andras direktmeddelanden. Det bryter
--     regeln att direktmeddelanden aldrig är öppna, oavsett behörighet.
--  d) Att koppla ett meddelande till ett ärende eller spara en översättning
--     gjorde ingenting: det fanns ingen policy för att uppdatera meddelanden.
--
-- Nytt: platskanaler. En kanal för ett boende eller en spelplats läses av den
-- som har ansvar för platsen eller dess område, utan medlemslista att hålla
-- uppdaterad. Ny personal på boendet ser kanalen direkt.

-- Vem får läsa en kanal: den som skapade den, öppen kanal med tillräcklig
-- behörighet, platskanal med ansvar för platsen, eller medlemskap.
-- Direktmeddelanden är aldrig öppna.
create or replace function public.can_read_channel(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channels c
    where c.id = ch
      and c.tenant_id = public.my_tenant()
      and (
        c.created_by = auth.uid()
        or (c.is_open and c.kind <> 'direkt' and public.my_tier() >= c.min_tier)
        or (c.kind = 'plats' and c.location_id is not null
            and public.has_scope(c.location_type, c.location_id))
        or exists (
          select 1 from public.channel_members m
          where m.channel_id = c.id and m.user_id = auth.uid()
        )
      )
  )
$$;

-- Vem får lägga till och ta bort medlemmar: den som skapade kanalen, och
-- administratörer för allt utom direktmeddelanden.
create or replace function public.can_manage_channel(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channels c
    where c.id = ch
      and c.tenant_id = public.my_tenant()
      and (c.created_by = auth.uid() or (c.kind <> 'direkt' and public.is_admin()))
  )
$$;

-- Ett direktmeddelande förblir privat: det kan inte göras öppet eller om
-- till en annan sorts kanal i efterhand.
create or replace function public.channel_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'direkt' then
    new.is_open := false;
  end if;
  if tg_op = 'UPDATE' and old.kind = 'direkt' and new.kind <> 'direkt' then
    raise exception 'Ett direktmeddelande kan inte göras om till en annan sorts kanal.';
  end if;
  return new;
end $$;

drop trigger if exists trg_channel_guard on public.channels;
create trigger trg_channel_guard before insert or update on public.channels
  for each row execute function public.channel_guard();

-- Kanalen syns för den som skapade den redan innan medlemmarna lagts till (a)
drop policy if exists "kanal läs" on public.channels;
create policy "kanal läs" on public.channels for select to authenticated
  using (created_by = auth.uid() or public.can_read_channel(id));

-- Alla kan starta ett direktmeddelande. Grupper, öppna kanaler och
-- platskanaler skapas av ledningen.
drop policy if exists "kanal skapa" on public.channels;
create policy "kanal skapa" on public.channels for insert to authenticated
  with check (created_by = auth.uid() and (kind = 'direkt' or public.is_coordinator()));

drop policy if exists "kanal andra" on public.channels;
create policy "kanal andra" on public.channels for update to authenticated
  using (created_by = auth.uid() or (kind <> 'direkt' and public.is_admin()))
  with check (created_by = auth.uid() or (kind <> 'direkt' and public.is_admin()));

-- Medlemmar (b, c). Den gamla policyn för allt delas upp.
drop policy if exists "medlem skriv" on public.channel_members;

drop policy if exists "medlem lägg till" on public.channel_members;
create policy "medlem lägg till" on public.channel_members for insert to authenticated
  with check (public.can_manage_channel(channel_id));

drop policy if exists "medlem ändra" on public.channel_members;
create policy "medlem ändra" on public.channel_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "medlem ta bort" on public.channel_members;
create policy "medlem ta bort" on public.channel_members for delete to authenticated
  using (user_id = auth.uid() or public.can_manage_channel(channel_id));

-- Meddelanden (d): den som får läsa ett meddelande får koppla det till ett
-- ärende eller spara en översättning. Själva texten, avsändaren och kanalen
-- går inte att ändra i efterhand.
drop policy if exists "chatt uppdatera" on public.messages;
create policy "chatt uppdatera" on public.messages for update to authenticated
  using (channel_id is null or public.can_read_channel(channel_id))
  with check (channel_id is null or public.can_read_channel(channel_id));

create or replace function public.message_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated'
     and (to_jsonb(new) - 'task_id' - 'translated_body' - 'translated_to')
         is distinct from (to_jsonb(old) - 'task_id' - 'translated_body' - 'translated_to') then
    raise exception 'Ett skickat meddelande går inte att ändra.';
  end if;
  return new;
end $$;

drop trigger if exists trg_message_guard on public.messages;
create trigger trg_message_guard before update on public.messages
  for each row execute function public.message_guard();

-- Läst-markering. Ligger separat från medlemskapet: att ha öppnat en öppen
-- kanal eller en platskanal ska inte ge läsrätt som finns kvar när
-- behörigheten tas bort.
create table if not exists public.channel_reads (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

alter table public.channel_reads enable row level security;
grant select, insert, update, delete on public.channel_reads to authenticated;

drop policy if exists "läst egen" on public.channel_reads;
create policy "läst egen" on public.channel_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_read_channel(channel_id));

drop policy if exists "tenant isolering" on public.channel_reads;
create policy "tenant isolering" on public.channel_reads
  as restrictive for all to authenticated
  using (tenant_id = public.my_tenant())
  with check (tenant_id = public.my_tenant());

-- Olästa för den inloggade i alla kanaler hen får läsa, inte bara där hen
-- är medlem. Egna meddelanden räknas inte som olästa.
create or replace view public.channel_unread
with (security_invoker = on) as
select
  c.id as channel_id,
  c.tenant_id,
  c.kind,
  c.name,
  c.is_open,
  auth.uid() as user_id,
  count(msg.id) filter (
    where msg.sender is distinct from auth.uid()
      and (greatest(r.last_read_at, m.last_read_at) is null
           or msg.created_at > greatest(r.last_read_at, m.last_read_at))
  ) as unread,
  max(msg.created_at) as last_message_at
from public.channels c
left join public.channel_reads r on r.channel_id = c.id and r.user_id = auth.uid()
left join public.channel_members m on m.channel_id = c.id and m.user_id = auth.uid()
left join public.messages msg on msg.channel_id = c.id
group by c.id, c.tenant_id, c.kind, c.name, c.is_open, r.last_read_at, m.last_read_at;

grant select on public.channel_unread to authenticated;

-- ============ 9. KONTROLL ============
select
  (select count(*) from pg_policies where tablename = 'shifts' and policyname = 'shifts ledning')       as pass_ledning,
  (select count(*) from pg_class where relname = 'group_standings' and reloptions is null)             as tabell_alla_matcher,
  (select count(*) from pg_trigger where tgname in ('trg_cost_shift', 'trg_rebook_role'))             as personalkostnad,
  (select count(*) from pg_views where schemaname = 'public'
     and viewname in ('meal_teams', 'meal_checkin_counts'))                                            as maltidsvyer,
  (select count(*) from storage.buckets where id = 'bilagor')                                          as bilagehink,
  (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'bilagor%')       as bilagepolicyer,
  (select count(*) from pg_policies where tablename = 'channel_members'
     and policyname in ('medlem lägg till', 'medlem ändra', 'medlem ta bort'))                          as chattmedlemmar,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'channel_reads')                                   as lastmarkering;
