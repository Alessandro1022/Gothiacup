-- Rensar all demodata. Skolor, planer och områden lämnas kvar.
delete from public.shift_swaps;
delete from public.shifts;
delete from public.incident_comments;
delete from public.incidents;
delete from public.tasks;
delete from public.news_posts;
delete from public.checklist_items;
delete from public.checklist_runs;
delete from public.crowd_counts;
delete from public.security_logs;
delete from public.arena_matches;
delete from public.night_rounds;
delete from public.room_issues;
delete from public.room_keys;
delete from public.team_assignments;
delete from public.classrooms;
update public.schools set capacity = 0;
select 'Demodata rensad' as status;
