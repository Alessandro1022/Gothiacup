-- TournamentOps · Del 12a · Nya roller
-- ============================================================================
-- KÖR DEN HÄR FÖRST, OCH FÖR SIG. Sedan 12b.
--
-- PostgreSQL vägrar använda ett nytt enum-värde i samma transaktion som det
-- skapades. Kör man allt i ett svep i SQL Editor fallerar det med
-- "unsafe use of new value". Därför ligger rollerna i en egen fil: den här
-- måste vara committad innan 12b kan räkna med värdena.
-- ============================================================================

-- ============ 1. NYA ROLLER ============
do $$
declare r text;
begin
  foreach r in array array[
    'security_lead', 'security_staff',
    'transport_staff', 'food_staff', 'stock_staff',
    'finance', 'interpreter', 'medic'
  ] loop
    begin
      execute format('alter type app_role add value if not exists %L', r);
    exception when others then null;
    end;
  end loop;
end $$;


select enumlabel as roll
from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'app_role'
order by e.enumsortorder;
