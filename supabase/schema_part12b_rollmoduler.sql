-- TournamentOps · Del 12b · Vad varje roll når
-- ============================================================================
-- KÖR EFTER 12a, som måste vara committad först.
--
-- Behörighetsmodellen hade två dimensioner: tier (hur senior) och scope
-- (vilken plats). Ingen av dem säger något om VILKET OMRÅDE någon jobbar
-- med. Lägger man bara till rollen 'food_staff' på tier 2 ser den personen
-- exakt vad en skolvärd ser — varken mer eller mindre. Rollen blir en
-- etikett utan innebörd.
--
-- Därför en tredje dimension: vilka moduler en roll når, och om den får
-- skriva eller bara läsa. Det är den som gör matansvarig till matansvarig.
--
-- Rollerna för lagledare och domare ligger INTE här. De är externa — de
-- ska se sitt eget lag respektive sina egna matcher, inte en delmängd av
-- personalens vyer. Det kräver en egen koppling person till lag, och det
-- är en annan sak än att vara med i driftorganisationen.
-- ============================================================================

-- ============ 1. TIERS FÖR DE NYA ROLLERNA ============
-- Tiers. De nya domänrollerna är operativa, inte chefsroller: säkerhets-
-- ansvarig och ekonomi ligger på 4 eftersom de behöver se över hela
-- turneringen, resten på 2 som övrig fältpersonal.
create or replace function public.role_tier(r app_role) returns int
language sql immutable as $$
  select case r
    when 'leadership' then 6
    when 'admin' then 5
    when 'coordinator' then 4
    when 'security_lead' then 4
    when 'finance' then 4
    when 'area_housing' then 3 when 'area_arenas' then 3
    when 'school_staff' then 2 when 'arena_staff' then 2
    when 'security_staff' then 2 when 'transport_staff' then 2
    when 'food_staff' then 2 when 'stock_staff' then 2
    when 'medic' then 2
    else 1 end
$$;

-- ============ 2. VILKA MODULER EN ROLL NÅR ============
create table if not exists public.role_modules (
  role app_role not null,
  module text not null,
  level text not null default 'read' check (level in ('read', 'write')),
  primary key (role, module)
);

alter table public.role_modules enable row level security;

-- Alla inloggade får läsa behörighetskartan: appen behöver den för menyn.
drop policy if exists "role_modules läs" on public.role_modules;
create policy "role_modules läs" on public.role_modules for select to authenticated using (true);

-- Bara ledning ändrar den
drop policy if exists "role_modules skriv" on public.role_modules;
create policy "role_modules skriv" on public.role_modules for all to authenticated
  using (public.my_tier() >= 6) with check (public.my_tier() >= 6);

-- ============ 3. STANDARDUPPSÄTTNING ============
-- Modulnycklar som finns idag, plus de som byggs i etapp 2 och 3. De
-- senare gör ingen skada nu och gör att rollerna fungerar direkt när
-- modulerna landar, i stället för att behöva ses över igen.
do $$
declare
  alla text[] := array[
    'incidents','tasks','shifts','areas','schools','arenas','map',
    'news','chat','docs','reports','ai','crisis','staff','history','structure',
    'transport','meals','stock','finance','medical','interpreters'
  ];
  -- Det alla i fält behöver för att göra sitt jobb
  bas text[] := array['incidents','tasks','shifts','news','chat','docs','map'];
  m text;
begin
  delete from public.role_modules;

  -- Ledning och admin: allt, med skrivrätt
  foreach m in array alla loop
    insert into public.role_modules (role, module, level) values
      ('leadership', m, 'write'), ('admin', m, 'write');
  end loop;

  -- Koordinator: allt utom plattformsnära delar
  foreach m in array alla loop
    insert into public.role_modules (role, module, level)
    values ('coordinator', m, case when m in ('crisis','structure') then 'read' else 'write' end);
  end loop;

  -- Områdesansvariga: drift i sitt område
  foreach m in array bas || array['areas','schools','arenas','reports','staff'] loop
    insert into public.role_modules (role, module, level) values
      ('area_housing', m, 'write'), ('area_arenas', m, 'write');
  end loop;

  -- Fältvärdar: sin plats
  foreach m in array bas loop
    insert into public.role_modules (role, module, level) values
      ('school_staff', m, 'write'), ('arena_staff', m, 'write');
  end loop;
  insert into public.role_modules (role, module, level) values
    ('school_staff', 'schools', 'write'), ('arena_staff', 'arenas', 'write');

  -- Domänroller: skriver i sitt eget område, läser lägesbilden
  foreach m in array bas loop
    insert into public.role_modules (role, module, level) values
      ('security_lead', m, 'write'), ('security_staff', m, 'write'),
      ('transport_staff', m, 'write'), ('food_staff', m, 'write'),
      ('stock_staff', m, 'write'), ('medic', m, 'write'),
      ('finance', m, 'read'), ('interpreter', m, 'read');
  end loop;

  insert into public.role_modules (role, module, level) values
    -- Säkerhet behöver se hela turneringen, inte bara sitt område
    ('security_lead', 'crisis', 'write'), ('security_lead', 'areas', 'read'),
    ('security_lead', 'schools', 'read'), ('security_lead', 'arenas', 'read'),
    ('security_lead', 'reports', 'read'), ('security_lead', 'staff', 'read'),
    ('security_lead', 'ai', 'read'),
    ('security_staff', 'schools', 'read'), ('security_staff', 'arenas', 'read'),

    ('transport_staff', 'transport', 'write'), ('transport_staff', 'stock', 'read'),
    ('transport_staff', 'schools', 'read'), ('transport_staff', 'arenas', 'read'),

    ('food_staff', 'meals', 'write'), ('food_staff', 'schools', 'read'),

    ('stock_staff', 'stock', 'write'), ('stock_staff', 'transport', 'read'),
    ('stock_staff', 'schools', 'read'),

    ('medic', 'medical', 'write'), ('medic', 'schools', 'read'),
    ('medic', 'arenas', 'read'),

    -- Ekonomi ser siffrorna överallt men styr ingen drift
    ('finance', 'finance', 'write'), ('finance', 'reports', 'read'),
    ('finance', 'transport', 'read'), ('finance', 'meals', 'read'),
    ('finance', 'stock', 'read'), ('finance', 'schools', 'read'),
    ('finance', 'staff', 'read'),

    ('interpreter', 'interpreters', 'write');

  -- Volontär: ser uppdraget, inget mer
  insert into public.role_modules (role, module, level) values
    ('volunteer', 'incidents', 'write'), ('volunteer', 'tasks', 'write'),
    ('volunteer', 'shifts', 'read'), ('volunteer', 'news', 'read'),
    ('volunteer', 'chat', 'write'), ('volunteer', 'docs', 'read');
end $$;

-- ============ 4. UPPSLAG ============
-- Vad den inloggade når. SECURITY DEFINER eftersom den läser profiles,
-- som filtreras av my_tenant().
create or replace function public.my_module_level(key text) returns text
language sql stable security definer set search_path = public as $$
  select rm.level
  from public.role_modules rm
  where rm.role = public.auth_role() and rm.module = key
$$;

create or replace function public.can_module(key text, need_write boolean default false)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    -- Ingen rad alls för rollen: behörighetskartan är inte ifylld, och då
    -- ska tier-regeln gälla som förut i stället för att låsa ute någon.
    when not exists (select 1 from public.role_modules where role = public.auth_role())
      then true
    when public.my_module_level(key) is null then false
    when need_write then public.my_module_level(key) = 'write'
    else true
  end
$$;

-- Hela kartan för den inloggade, i ett anrop. Appen använder den för menyn.
create or replace function public.my_modules()
returns table (module text, level text)
language sql stable security definer set search_path = public as $$
  select rm.module, rm.level
  from public.role_modules rm
  where rm.role = public.auth_role()
$$;

-- ============ 5. KONTROLL ============
select r.role, count(*) as moduler,
       count(*) filter (where r.level = 'write') as med_skrivratt
from public.role_modules r
group by r.role
order by public.role_tier(r.role) desc, r.role;
