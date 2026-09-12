-- TournamentOps · Demodata för en turneringsdag
-- Kör EFTER gothia_data.sql. Bygger en realistisk lägesbild att visa upp.
-- Kör reset_demo.sql för att rensa allt detta igen.

-- Allt kopplas till första profilen i systemet (dig).
create or replace function public.demo_user() returns uuid
language sql stable as $$ select id from public.profiles order by created_at limit 1 $$;

-- ============ KLASSRUM ============
-- 6 salar på var och en av de 12 största skolorna
insert into public.classrooms (school_id, name, capacity)
select s.id, 'Sal ' || n, (array[24,28,30,32,40,60])[n]
from (select id, row_number() over (order by name) rn from public.schools limit 12) s
cross join generate_series(1,6) n;

update public.schools set capacity = 214
where id in (select id from public.schools order by name limit 12);

-- ============ LAG ============
insert into public.team_assignments
  (school_id, classroom_id, team_name, country, group_size, contact_name, contact_phone, status, checked_in_at)
select c.school_id, c.id, t.namn, t.land, t.antal, t.kontakt, t.tel, t.status::team_status,
       case when t.status = 'checked_in' then now() - (t.rn || ' hours')::interval end
from (
  select *, row_number() over () rn from (values
    ('IFK Göteborg P14','Sverige',22,'Johan Ek','070-111 22 33','checked_in'),
    ('Beşiktaş JK P14','Turkiet',24,'Emre Kaya','+90 532 111','checked_in'),
    ('Kista SC F16','Sverige',20,'Sara Lind','070-222 33 44','checked_in'),
    ('Vasalunds IF P16','Sverige',21,'Petter Ahl','070-333 44 55','checked_in'),
    ('FC Nordsjælland P15','Danmark',23,'Mads Holm','+45 20 11 22','checked_in'),
    ('Lillestrøm SK P15','Norge',22,'Ola Berg','+47 900 11','checked_in'),
    ('Valencia CF P14','Spanien',25,'Pau Serra','+34 600 11','checked_in'),
    ('Hapoel Tel Aviv P17','Israel',19,'Noam Barak','+972 50 11','checked_in'),
    ('Kaizer Chiefs P16','Sydafrika',24,'Sipho Dube','+27 82 11','expected'),
    ('Urawa Reds F15','Japan',20,'Yuki Sato','+81 90 11','expected'),
    ('Boca Juniors P17','Argentina',23,'Diego Rossi','+54 11 11','expected'),
    ('Sporting CP F14','Portugal',21,'Ana Costa','+351 91 11','expected'),
    ('Ajax P15','Nederländerna',22,'Tim Bakker','+31 6 11','expected'),
    ('Hammarby IF F17','Sverige',20,'Lisa Ek','070-444 55 66','checked_out'),
    ('Örgryte IS P13','Sverige',18,'Karl Nyström','070-555 66 77','checked_in'),
    ('Häcken F13','Sverige',19,'Mia Olsson','070-666 77 88','checked_in')
  ) v(namn, land, antal, kontakt, tel, status)
) t
join (select id, school_id, row_number() over (order by school_id, name) rn
      from public.classrooms) c on c.rn = t.rn;

-- ============ INCIDENTER ============
insert into public.incidents (title, description, severity, status, location_type, location_id, reported_by, created_at)
select i.titel, i.beskr, i.sev::incident_severity, i.st::incident_status, 'school', s.id, public.demo_user(),
       now() - (i.timmar || ' hours')::interval
from (
  select *, row_number() over () rn from (values
    ('Vattenläcka i duschrum','Vatten på golvet i omklädningsrum 2. Fastighetsjour kontaktad.','high','in_progress',4),
    ('Obehörig person på skolgården','Person avvisad av vakt. Ingen incident i övrigt.','medium','resolved',9),
    ('Larm utlöst kl 03:12','Falsklarm, rök från kök. Larmet återställt.','medium','resolved',7),
    ('Stöld av tre cyklar','Anmälan upprättad. Kameror saknas på platsen.','high','open',12),
    ('Bråk mellan två lag','Ledare på plats, situationen lugnad. Uppföljning i morgon.','critical','in_progress',2),
    ('Trasig ytterdörr går ej att låsa','Provisorisk lösning på plats, låssmed bokad.','high','open',1),
    ('Sjukdomsfall, magsjuka','Fyra spelare isolerade i egen sal enligt rutin.','medium','in_progress',6)
  ) v(titel, beskr, sev, st, timmar)
) i
join (select id, row_number() over (order by name) rn from public.schools limit 12) s on s.rn = i.rn;

-- ============ UPPGIFTER ============
insert into public.tasks (title, description, status, priority, created_by, assigned_to)
select t.titel, t.beskr, t.st::task_status, t.pri::task_priority, public.demo_user(), public.demo_user()
from (values
  ('Komplettera madrasser Hvitfeldtska','12 madrasser saknas inför kvällens incheckning.','todo','high'),
  ('Beställ mer toalettpapper Centrum','Gäller samtliga skolor i Centrum 1.','todo','normal'),
  ('Följ upp låssmed Annedalsskolan','Bekräfta att dörren är åtgärdad före natten.','in_progress','high'),
  ('Ronda parkering Heden','Felparkerade bussar blockerar utfart.','in_progress','normal'),
  ('Uppdatera nyckellista Burgården','Två nycklar saknas i avstämningen.','todo','normal'),
  ('Rapportera nattens händelser till ledning','Sammanställning före kl 08.','done','normal'),
  ('Byt trasig belysning gymnastiksal','Hälften av armaturerna ur funktion.','todo','low')
) t(titel, beskr, st, pri);

-- ============ FELANMÄLNINGAR ============
insert into public.room_issues (school_id, title, description, status, reported_by, created_at)
select s.id, i.titel, i.beskr, i.st::issue_status, public.demo_user(), now() - (i.h || ' hours')::interval
from (
  select *, row_number() over () rn from (values
    ('Trasig dusch','Kallvatten saknas i dusch 3.','open',5),
    ('Fönster går ej att stänga','Sal 104, andra våningen.','in_progress',9),
    ('Toalett stopp','Herrtoalett bottenplan.','open',3),
    ('Trasig stol i matsal','Två stolar kasserade.','resolved',20),
    ('Wifi nere i C-huset','Påverkar lagledarnas incheckning.','in_progress',7)
  ) v(titel, beskr, st, h)
) i
join (select id, row_number() over (order by name) rn from public.schools limit 5) s on s.rn = i.rn;

-- ============ NATTRONDER ============
insert into public.night_rounds (school_id, all_ok, notes, performed_by, performed_at)
select s.id,
       case when s.rn % 4 = 0 then false else true end,
       case when s.rn % 4 = 0 then 'Hög ljudnivå efter kl 23. Ledare tillsagda.' end,
       public.demo_user(), now() - interval '9 hours'
from (select id, row_number() over (order by name) rn from public.schools limit 10) s;

-- ============ NYCKLAR ============
insert into public.room_keys (school_id, label, status, holder_name)
select s.id, k.lbl, k.st::key_status, k.holder
from (
  select *, row_number() over () rn from (values
    ('Huvudentré A','out','Nattvärd Centrum'),
    ('Gymnastiksal','in',null),
    ('Kök','out','Köksansvarig'),
    ('Förråd B','in',null),
    ('Sidoentré C','lost','Anmäld borttappad 12/7')
  ) v(lbl, st, holder)
) k
join (select id, row_number() over (order by name) rn from public.schools limit 5) s on s.rn = k.rn;

-- ============ MATCHER MED RISKFLAGGOR ============
insert into public.arena_matches
  (arena_id, surface_label, home_team, away_team, category, starts_at, status, risk_level, risk_note)
select a.id, m.plan, m.hemma, m.borta, m.klass,
       date_trunc('day', now()) + (m.tim || ' hours')::interval,
       m.st::match_status, m.risk::risk_level, m.notering
from (
  select *, row_number() over () rn from (values
    ('Plan 3','IFK Göteborg P14','Beşiktaş JK P14','B14',9,'finished','green',null),
    ('Plan 7','Kista SC F16','Vasalunds IF F16','G16',11,'finished','green',null),
    ('Plan 1','Boca Juniors P17','Hapoel Tel Aviv P17','B17',14,'ongoing','red','Stort supporterfölje båda lag. Tidigare tillbud vid möte 2025. Säkerhetsgruppen på plats från 13:00.'),
    ('Plan 4','Valencia CF P14','Sporting CP F14','B14',15,'scheduled','yellow','Derbykänsla, fullsatt läktare väntas. Matchdelegat kopplad.'),
    ('Plan 2','Ajax P15','Lillestrøm SK P15','B15',16,'scheduled','green',null),
    ('Plan 9','Kaizer Chiefs P16','Örgryte IS P16','B16',17,'scheduled','yellow','Sen avspark, stor publik. Matchdelegat kopplad.'),
    ('Plan 5','Urawa Reds F15','Häcken F15','G15',18,'scheduled','green',null)
  ) v(plan, hemma, borta, klass, tim, st, risk, notering)
) m
join (select id, row_number() over (order by name) rn from public.arenas limit 7) a on a.rn = m.rn;

-- ============ PUBLIKRÄKNING ============
insert into public.crowd_counts (arena_id, count, noted_by, created_at)
select a.id, c.antal, public.demo_user(), now() - (c.h || ' hours')::interval
from (
  select *, row_number() over () rn from (values
    (1450,1),(1180,3),(890,5),(420,7)
  ) v(antal, h)
) c
join (select id, row_number() over (order by name) rn from public.arenas limit 4) a on a.rn = c.rn;

-- ============ SÄKERHETSLOGG ============
insert into public.security_logs (arena_id, entry, severity, logged_by, created_at)
select a.id, l.txt, l.sev::incident_severity, public.demo_user(), now() - (l.h || ' hours')::interval
from (
  select *, row_number() over () rn from (values
    ('Avspärrning uppsatt mot norra läktaren.','low',4),
    ('Två personer avvisade efter tillsägelse.','medium',2),
    ('Sjukvård tillkallad, spelare med misstänkt fraktur.','high',1),
    ('Publikflöde omdirigerat via grind 2.','low',3)
  ) v(txt, sev, h)
) l
join (select id, row_number() over (order by name) rn from public.arenas limit 4) a on a.rn = l.rn;

-- ============ PASS ============
-- Pågående pass just nu ger rätt bemanningsgrad i sidomenyn
insert into public.shifts
  (user_id, location_type, location_id, starts_at, ends_at, role_note, status, checked_in_at, created_by)
select public.demo_user(), 'school', s.id,
       now() - (p.start || ' hours')::interval,
       now() + (p.slut || ' hours')::interval,
       p.roll, p.st::shift_status,
       case when p.st = 'checked_in' then now() - (p.start || ' hours')::interval end,
       public.demo_user()
from (
  select *, row_number() over () rn from (values
    ('Skolvärd dag',4,4,'checked_in'),
    ('Skolvärd dag',3,5,'checked_in'),
    ('Nattvärd',2,6,'checked_in'),
    ('Skolvärd kväll',1,7,'planned'),
    ('Områdesrond',5,3,'checked_in'),
    ('Skolvärd dag',6,2,'planned')
  ) v(roll, start, slut, st)
) p
join (select id, row_number() over (order by name) rn from public.schools limit 6) s on s.rn = p.rn;

-- ============ NYHETER ============
insert into public.news_posts (title, body, pinned, min_tier, created_by) values
('Värme under torsdagen – se till att lagen dricker',
 'SMHI varnar för 28 grader. Extra vatten finns att hämta på Heden och Kviberg. Påminn lagledare vid incheckning.', true, 1, public.demo_user()),
('Ny rutin för nyckelhantering',
 'Alla nycklar kvitteras digitalt i systemet från och med idag. Pappersliggaren används inte längre.', false, 1, public.demo_user()),
('Ledningsmöte flyttat till 07:30',
 'Gäller områdeschefer och säkerhet. Plats: Heden, konferensrum 2.', false, 4, public.demo_user());

select 'Demodata inlagd' as status,
  (select count(*) from public.team_assignments) as lag,
  (select count(*) from public.incidents) as incidenter,
  (select count(*) from public.arena_matches) as matcher,
  (select count(*) from public.arena_matches where risk_level <> 'green') as flaggade_matcher,
  (select count(*) from public.shifts) as pass;
