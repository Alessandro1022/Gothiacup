-- TournamentOps · Del 13 · Lager och material
-- ============================================================================
-- Första modulen i etapp 2. Transport flyttar materiel, så lagret måste
-- finnas först för att det ska finnas något att flytta.
--
-- Designval: RÖRELSER är sanningen, saldot är en vy. Alternativet — en
-- saldokolumn som uppdateras — driver förr eller senare isär från
-- verkligheten, och då finns inget sätt att se var det gick fel. Med en
-- rörelsejournal går varje madrass att följa, och "rapportera skadad eller
-- förlorad" blir en rörelse som alla andra i stället för ett specialfall.
--
-- Kör efter schema_part12b_rollmoduler.sql.
-- ============================================================================

-- ============ 1. ARTIKLAR ============
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  name text not null,
  category text not null default 'ovrigt',      -- boende, idrott, kontor, ovrigt
  unit text not null default 'st',
  min_level int not null default 0,             -- under detta varnar vyn nedan
  qr_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_items_tenant on public.stock_items (tenant_id);

-- ============ 2. RÖRELSER ============
do $$
begin
  create type stock_move_kind as enum
    ('inleverans', 'uttag', 'utlan', 'retur', 'skadad', 'forlorad', 'inventering', 'flytt');
exception when duplicate_object then null;
end $$;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants(id) on delete cascade,
  item_id uuid not null references public.stock_items(id) on delete cascade,
  kind stock_move_kind not null,
  -- Mängden skrivs alltid positiv. Tecknet räknas fram av regeln nedan, så
  -- en felskrivning inte kan göra ett uttag till en inleverans.
  qty int not null check (qty > 0),
  location_type location_type,
  location_id uuid,
  to_location_type location_type,               -- bara vid flytt
  to_location_id uuid,
  borrower text not null default '',            -- vid utlån
  note text not null default '',
  moved_by uuid references public.profiles(id),
  moved_at timestamptz not null default now()
);

create index if not exists idx_stock_moves_item on public.stock_movements (item_id, moved_at desc);
create index if not exists idx_stock_moves_tenant on public.stock_movements (tenant_id);
create index if not exists idx_stock_moves_loc on public.stock_movements (location_type, location_id);

-- Hur varje rörelsetyp påverkar saldot på platsen den gäller.
-- Inventering hanteras separat: den SÄTTER ett saldo i stället för att
-- justera det, och räknas därför aldrig in här.
create or replace function public.stock_sign(k stock_move_kind) returns int
language sql immutable as $$
  select case k
    when 'inleverans' then 1
    when 'retur' then 1
    when 'uttag' then -1
    when 'utlan' then -1
    when 'skadad' then -1
    when 'forlorad' then -1
    else 0
  end
$$;

-- ============ 3. SALDO ============
-- Varje rörelse vecklas ut till en eller två poster: en flytt drar av på
-- platsen den lämnar och lägger till på den den kommer till. Utan det
-- hade en flytt inte påverkat saldot alls.
--
-- En inventering RÄKNAR OM i stället för att justera: den sätter saldot
-- till det man faktiskt hittade, och rörelser före den räknas inte med.
create or replace view public.stock_balances
with (security_invoker = on) as
with deltas as (
  -- Vanliga rörelser: en post på sin egen plats
  select m.tenant_id, m.item_id, m.location_type, m.location_id,
         m.qty * public.stock_sign(m.kind) as delta, m.moved_at
  from public.stock_movements m
  where m.kind not in ('flytt', 'inventering')

  union all

  -- Flytt, avgående
  select m.tenant_id, m.item_id, m.location_type, m.location_id,
         -m.qty, m.moved_at
  from public.stock_movements m where m.kind = 'flytt'

  union all

  -- Flytt, ankommande
  select m.tenant_id, m.item_id, m.to_location_type, m.to_location_id,
         m.qty, m.moved_at
  from public.stock_movements m where m.kind = 'flytt'
),
inventeringar as (
  select distinct on (item_id, location_type, location_id)
         tenant_id, item_id, location_type, location_id, qty, moved_at
  from public.stock_movements
  where kind = 'inventering'
  order by item_id, location_type, location_id, moved_at desc
),
platser as (
  select tenant_id, item_id, location_type, location_id from deltas
  union
  select tenant_id, item_id, location_type, location_id from inventeringar
),
raknat as (
  select
    pl.tenant_id, pl.item_id, pl.location_type, pl.location_id,
    coalesce(inv.qty, 0) + coalesce((
      select sum(d.delta) from deltas d
      where d.item_id = pl.item_id
        and d.location_type is not distinct from pl.location_type
        and d.location_id is not distinct from pl.location_id
        and (inv.moved_at is null or d.moved_at > inv.moved_at)
    ), 0) as qty
  from platser pl
  left join inventeringar inv
    on inv.item_id = pl.item_id
   and inv.location_type is not distinct from pl.location_type
   and inv.location_id is not distinct from pl.location_id
)
select
  r.tenant_id, r.item_id, i.name as item_name, i.unit, i.category, i.min_level,
  r.location_type, r.location_id,
  case r.location_type
    when 'school' then (select s.name from public.schools s where s.id = r.location_id)
    when 'arena'  then (select a.name from public.arenas a where a.id = r.location_id)
    else 'Centrallager'
  end as location_name,
  r.qty
from raknat r
join public.stock_items i on i.id = r.item_id;

-- Totalt per artikel, och vad som ligger under gränsen
create or replace view public.stock_totals
with (security_invoker = on) as
select
  i.tenant_id, i.id as item_id, i.name, i.unit, i.category, i.min_level, i.qr_code,
  coalesce(sum(b.qty), 0) as total,
  coalesce(sum(b.qty) filter (where b.location_type is null), 0) as i_centrallager,
  coalesce(sum(b.qty), 0) < i.min_level as under_grans,
  (select count(*) from public.stock_movements m
    where m.item_id = i.id and m.kind = 'utlan') -
  (select count(*) from public.stock_movements m
    where m.item_id = i.id and m.kind = 'retur') as utlanade_poster
from public.stock_items i
left join public.stock_balances b on b.item_id = i.id
group by i.id;

-- ============ 4. BEHÖRIGHET ============
alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;

-- Läsning för alla som når modulen, skrivning för dem med skrivrätt.
-- can_module kommer från del 12b och svarar true om kartan inte är ifylld,
-- så det här fungerar även innan rollerna är satta.
drop policy if exists "lager läs" on public.stock_items;
create policy "lager läs" on public.stock_items for select to authenticated
  using (public.can_module('stock'));

drop policy if exists "lager skriv" on public.stock_items;
create policy "lager skriv" on public.stock_items for all to authenticated
  using (public.can_module('stock', true)) with check (public.can_module('stock', true));

drop policy if exists "lagerrorelse läs" on public.stock_movements;
create policy "lagerrorelse läs" on public.stock_movements for select to authenticated
  using (public.can_module('stock'));

-- En rörelse ska aldrig kunna ändras i efterhand: journalen är underlaget
-- för var materielen tog vägen. Rättelse görs med en motbokning.
drop policy if exists "lagerrorelse skapa" on public.stock_movements;
create policy "lagerrorelse skapa" on public.stock_movements for insert to authenticated
  with check (public.can_module('stock', true));

drop policy if exists "lagerrorelse radera" on public.stock_movements;
create policy "lagerrorelse radera" on public.stock_movements for delete to authenticated
  using (public.my_tier() >= 5);

drop policy if exists "tenant isolering" on public.stock_items;
create policy "tenant isolering" on public.stock_items
  as restrictive for all to authenticated
  using (tenant_id = public.my_tenant()) with check (tenant_id = public.my_tenant());

drop policy if exists "tenant isolering" on public.stock_movements;
create policy "tenant isolering" on public.stock_movements
  as restrictive for all to authenticated
  using (tenant_id = public.my_tenant()) with check (tenant_id = public.my_tenant());

grant select on public.stock_balances, public.stock_totals to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.stock_movements;
exception when duplicate_object then null;
end $$;

-- ============ 5. MODULEN ============
-- Avstängd överallt till att börja med, påslagen i de paket som ska ha den.
select public.add_module('stock');

update public.plans set features = features || '{"stock":true}'
 where slug in ('komplett');

-- Turneringar som redan kör Komplett ska få den direkt
update public.tenants set features = features || '{"stock":true}'
 where plan_name = 'Komplett' and not plan_customized;

-- ============ 6. KONTROLL ============
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='stock_items')      as artiklar,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='stock_movements')  as rorelser,
  (select count(*) from pg_views
    where schemaname='public' and viewname in ('stock_balances','stock_totals')) as vyer,
  (select level from public.role_modules
    where role='stock_staff' and module='stock')                   as lageransvarig;
