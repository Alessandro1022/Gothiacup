-- TournamentOps · Del 9 · Modulregler och nya turneringar
-- ============================================================================
-- Tre hål som del 7 och 8 lämnade efter sig:
--
-- 1. En turnering som skapas EFTER del 7 fick ingen rad i crisis_state.
--    Krisläget gick då inte att slå på: uppdateringen träffade noll rader.
--
-- 2. En turnering skapad direkt i SQL fick features = '{}', vilket appen
--    tolkade som att alla moduler är på.
--
-- 3. Allvarligast: appen läste "modulen är på om den inte uttryckligen är
--    avstängd". När hotell, transport, måltider, lager och ekonomi byggs
--    nämner inget befintligt paket dem — och då blir de gratis för alla,
--    inklusive Bas-kunden. Hela prismodellen är moduler, så den vägen
--    läcker intäkter varje gång något nytt byggs.
--
--    Regeln vänds: en modul är PÅ bara om den uttryckligen står som true.
--    Därför måste varje turnering ha en komplett uppsättning nycklar, och
--    det är vad normaliseringen nedan ser till.
--
-- Kör efter schema_part8_plans.sql.
-- ============================================================================

-- ============ 1. KOMPLETT MODULUPPSÄTTNING PÅ ALLA TURNERINGAR ============
-- Nycklarna måste matcha FEATURE_KEYS i lib/features.ts.
create or replace function public.module_keys() returns text[]
language sql immutable as $$
  select array[
    'incidents','tasks','shifts',
    'areas','schools','arenas','map',
    'news','chat','docs',
    'reports','ai','crisis','staff','history','structure'
  ]
$$;

-- Fyller ut en moduluppsättning så att varje känd nyckel finns med.
-- En nyckel som saknas sätts till fallback: true när turneringen inte har
-- någon uppsättning alls (annars hade den låsts ute), annars false.
create or replace function public.normalize_features(f jsonb) returns jsonb
language plpgsql immutable as $$
declare
  k text;
  tom boolean := (f is null or f = '{}'::jsonb);
  ut jsonb := coalesce(f, '{}'::jsonb);
begin
  foreach k in array public.module_keys() loop
    if not (ut ? k) then
      ut := ut || jsonb_build_object(k, tom);
    end if;
  end loop;
  return ut;
end $$;

update public.tenants
   set features = public.normalize_features(features);

-- ============ 2. NY TURNERING FÅR ALLT DEN BEHÖVER ============
-- Krisrad, och en komplett moduluppsättning hämtad från paketet om ett är
-- valt. Utan det här blir en turnering som skapas i Plattform-vyn halvtrasig.
create or replace function public.tenant_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
declare plan_features jsonb;
begin
  if new.plan_id is not null then
    select p.features into plan_features from public.plans p where p.id = new.plan_id;
  end if;

  new.features := public.normalize_features(
    case
      when new.features is null or new.features = '{}'::jsonb then plan_features
      else new.features
    end
  );
  return new;
end $$;

drop trigger if exists trg_tenant_defaults on public.tenants;
create trigger trg_tenant_defaults before insert or update on public.tenants
  for each row execute function public.tenant_defaults();

-- Krisraden måste skapas efter att turneringen finns
create or replace function public.tenant_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.crisis_state (tenant_id, active)
  values (new.id, false)
  on conflict (tenant_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_tenant_after_insert on public.tenants;
create trigger trg_tenant_after_insert after insert on public.tenants
  for each row execute function public.tenant_after_insert();

-- Laga de turneringar som redan saknar krisrad
insert into public.crisis_state (tenant_id, active)
select t.id, false from public.tenants t
where not exists (select 1 from public.crisis_state c where c.tenant_id = t.id);

-- ============ 3. NÄR EN NY MODUL BYGGS ============
-- Kör den här med modulens nyckel, så läggs den till som AVSTÄNGD överallt.
-- Sedan slås den på för de paket som ska sälja den.
--
--   select public.add_module('ekonomi');
--   update public.plans set features = features || '{"ekonomi":true}'
--    where slug = 'komplett';
--
-- Glöms det bort blir modulen avstängd, inte gratis. Det är rätt håll att
-- fela åt när moduler är det man tar betalt för.
create or replace function public.add_module(key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.plans
     set features = features || jsonb_build_object(key, false)
   where not (features ? key);

  update public.tenants
     set features = features || jsonb_build_object(key, false)
   where not (features ? key);
end $$;

-- ============ 4. KONTROLL ============
select t.name as turnering,
       t.plan_name,
       (select count(*) from jsonb_object_keys(t.features)) as nycklar,
       (select count(*) from jsonb_each_text(t.features) f where f.value = 'true') as moduler_pa,
       (select count(*) from public.crisis_state c where c.tenant_id = t.id) as krisrad
from public.tenants t
order by t.name;
