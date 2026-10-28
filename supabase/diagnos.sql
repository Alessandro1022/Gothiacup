-- TournamentOps · Diagnos
-- ============================================================================
-- Säker att köra i vilket läge som helst. Den läser bara systemkatalogen och
-- rör aldrig en kolumn som kanske inte finns, så den kan inte krascha av
-- samma skäl som den ska upptäcka.
--
-- Byt e-posten på sista raden i DO-blocket till din egen.
-- ============================================================================

-- ---------- 1. Vilka delar är körda? ----------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'tenants')            as del6_tenants,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'tenant_id')                                     as del7_tenant_id,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'platform_owner')                                as del7_platform_owner,
  (select count(*) from information_schema.routines
    where routine_schema = 'public' and routine_name = 'my_tenant')      as del7_funktion,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'tenant isolering')     as del7_isolering,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'plans')              as del8_plans;

-- Tolkning:
--   del6_tenants        1 = del 6 körd
--   del7_tenant_id      1 = del 7 kom åtminstone till sektion 2
--   del7_platform_owner 1 = samma sak; 0 = del 7 är INTE körd
--   del7_funktion       1 = my_tenant() finns
--   del7_isolering     32 = alla isoleringspolicies på plats
--   del8_plans          1 = del 8 körd

-- ---------- 2. Ditt eget konto ----------
-- Körs bara om kolumnerna finns, därför dynamisk SQL.
do $$
declare
  har_owner boolean;
  har_tenant boolean;
  rad record;
  epost text := 'DIN@EPOST.SE';        -- << BYT HÄR
begin
  select count(*) = 1 into har_owner from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'platform_owner';
  select count(*) = 1 into har_tenant from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'tenant_id';

  if not har_owner then
    raise notice '---';
    raise notice 'Del 7 är INTE körd: kolumnen platform_owner saknas.';
    raise notice 'Kör schema_part7_multitenant.sql, sedan make_me_owner.sql.';
    raise notice '---';
  end if;

  for rad in execute format(
    'select email, role::text as roll%s%s from public.profiles where lower(email) = lower(%L)',
    case when har_owner  then ', platform_owner::text as agare' else ', ''(saknas)'' as agare' end,
    case when har_tenant then ', coalesce(tenant_id::text, ''(ingen)'') as turnering' else ', ''(saknas)'' as turnering' end,
    epost)
  loop
    raise notice 'Konto: % | roll: % | agare: % | turnering: %',
      rad.email, rad.roll, rad.agare, rad.turnering;
  end loop;

  if not found then
    raise notice 'Hittade ingen anvandare med e-post %. Kontrollera stavningen.', epost;
  end if;
end $$;
