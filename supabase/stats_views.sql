-- TournamentOps · Prestandavyer
-- Databasen räknar i stället för mobilen. Kör i SQL Editor.

-- ============ INDEX ============
create index if not exists idx_teams_school       on public.team_assignments(school_id);
create index if not exists idx_teams_status       on public.team_assignments(status);
create index if not exists idx_classrooms_school  on public.classrooms(school_id);
create index if not exists idx_issues_school      on public.room_issues(school_id);
create index if not exists idx_incidents_loc      on public.incidents(location_type, location_id);
create index if not exists idx_shifts_time        on public.shifts(starts_at, ends_at);
create index if not exists idx_matches_arena_time on public.arena_matches(arena_id, starts_at);

-- ============ SKOLSTATISTIK ============
create or replace view public.school_stats as
select
  s.id, s.name, s.address, s.capacity, s.area_id, s.lat, s.lng,
  coalesce(ti.in_house, 0)       as in_house,
  coalesce(ti.teams_in, 0)       as teams_in,
  coalesce(te.teams_expected, 0) as teams_expected,
  coalesce(ri.open_issues, 0)    as open_issues,
  coalesce(ic.open_incidents, 0) as open_incidents
from public.schools s
left join (
  select school_id, sum(group_size) as in_house, count(*) as teams_in
  from public.team_assignments where status = 'checked_in' group by school_id
) ti on ti.school_id = s.id
left join (
  select school_id, count(*) as teams_expected
  from public.team_assignments where status = 'expected' group by school_id
) te on te.school_id = s.id
left join (
  select school_id, count(*) as open_issues
  from public.room_issues where status <> 'resolved' group by school_id
) ri on ri.school_id = s.id
left join (
  select location_id, count(*) as open_incidents
  from public.incidents
  where status <> 'resolved' and location_type = 'school' group by location_id
) ic on ic.location_id = s.id;

-- ============ OMRÅDESSTATISTIK ============
create or replace view public.area_stats as
select
  a.id, a.name, a.description,
  coalesce(sc.n_schools, 0)      as n_schools,
  coalesce(ar.n_arenas, 0)       as n_arenas,
  coalesce(sc.teams_in, 0)       as teams_in,
  coalesce(sc.in_house, 0)       as in_house,
  coalesce(sc.capacity, 0)       as capacity,
  coalesce(sc.open_issues, 0)    as open_issues,
  coalesce(sc.open_incidents, 0) + coalesce(ar.open_incidents, 0) as open_incidents
from public.areas a
left join (
  select area_id,
         count(*) as n_schools,
         sum(teams_in) as teams_in,
         sum(in_house) as in_house,
         sum(capacity) as capacity,
         sum(open_issues) as open_issues,
         sum(open_incidents) as open_incidents
  from public.school_stats group by area_id
) sc on sc.area_id = a.id
left join (
  select ar.area_id, count(*) as n_arenas,
         coalesce(sum(ic.open_incidents), 0) as open_incidents
  from public.arenas ar
  left join (
    select location_id, count(*) as open_incidents
    from public.incidents
    where status <> 'resolved' and location_type = 'arena' group by location_id
  ) ic on ic.location_id = ar.id
  group by ar.area_id
) ar on ar.area_id = a.id;

-- Vyerna visar endast aggregerade siffror, inga personuppgifter
grant select on public.school_stats to authenticated;
grant select on public.area_stats   to authenticated;

analyze;

select 'Klart' as status,
  (select count(*) from public.school_stats) as skolor,
  (select count(*) from public.area_stats)   as omraden;
