-- TournamentOps · Gör dig själv till plattformsägare
-- ============================================================================
-- Kör EN gång efter schema_part7_multitenant.sql. Byt e-posten på rad 14.
--
-- Varför triggers stängs av: protect_role_change och protect_tenant_change
-- kräver att den som ändrar redan är admin respektive ägare. I SQL Editor
-- finns ingen inloggad användare, så båda skulle stoppa den allra första
-- ändringen. Ett moment 22 som bara går att bryta här.
-- ============================================================================

do $$
declare
  me uuid;
  target_email text := 'wehelie@aetossystems.se';   -- << BYT TILL DIN E-POST
  gothia uuid;
begin
  select id into me from public.profiles where lower(email) = lower(target_email);
  if me is null then
    raise exception 'Hittar ingen användare med e-post %. Logga in i appen en gång först.', target_email;
  end if;

  select id into gothia from public.tenants where slug = 'gothia-cup';

  alter table public.profiles disable trigger trg_protect_role;
  alter table public.profiles disable trigger trg_protect_tenant;

  update public.profiles
     set role = 'leadership',
         platform_owner = true,
         tenant_id = coalesce(tenant_id, gothia)
   where id = me;

  alter table public.profiles enable trigger trg_protect_role;
  alter table public.profiles enable trigger trg_protect_tenant;

  raise notice 'Klart: % är nu plattformsägare med rollen leadership.', target_email;
end $$;

select email, role, platform_owner,
       (select name from public.tenants t where t.id = p.tenant_id) as turnering
from public.profiles p
where platform_owner;
