-- Slår ihop områdena. Skolorna ligger i "Hisingen", planerna i "Hisingen 1/2/3"
-- vilket gör att korten visar 0 skolor. Efter detta finns nio rena områden.

update public.arenas set area_id = (select id from public.areas where name = 'Hisingen')
where area_id in (select id from public.areas where name in ('Hisingen 1', 'Hisingen 2', 'Hisingen 3'));

update public.arenas set area_id = (select id from public.areas where name = 'Centrum')
where area_id in (select id from public.areas where name = 'Söder');

update public.arenas set area_id = (select id from public.areas where name = 'Frölunda')
where area_id in (select id from public.areas where name = 'Väster');

-- Rensa områden som blivit tomma
delete from public.areas a
where not exists (select 1 from public.schools s where s.area_id = a.id)
  and not exists (select 1 from public.arenas ar where ar.area_id = a.id);

select name,
  (select count(*) from public.schools s where s.area_id = a.id) as skolor,
  (select count(*) from public.arenas ar where ar.area_id = a.id) as planer
from public.areas a order by name;
