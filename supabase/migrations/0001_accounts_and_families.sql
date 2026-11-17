-- Aplicar una vez en un proyecto Supabase nuevo, desde SQL Editor.
-- Todo el cambio es transaccional. No modifica ni importa el almacenamiento local.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index family_members_family_idx on public.family_members(family_id);
create table public.family_invites (
  family_id uuid primary key references public.families(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '7 days'
);

-- La consulta evita políticas recursivas en family_members.
create function private.current_family_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select family_id from public.family_members where user_id = (select auth.uid()) $$;
revoke all on function private.current_family_id() from public, anon;
grant execute on function private.current_family_id() to authenticated;

-- Mismo criterio básico que JavaScript: espacios, minúsculas y diacríticos.
create function public.product_name_key(p_name text) returns text
language sql immutable strict set search_path = ''
as $$ select lower(regexp_replace(normalize(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), NFD), U&'[\0300-\036f]', '', 'g')) $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (public.product_name_key(name)) stored,
  unit text not null check (unit in ('unidad', 'kg', 'litro', 'paquete')),
  unique (family_id, name_key),
  unique (family_id, id),
  unique (family_id, id, unit)
);
create table public.pending_items (
  family_id uuid not null references public.families(id) on delete cascade,
  product_id uuid not null,
  unit text not null,
  quantity numeric(7,3) not null check (quantity > 0 and quantity <= 9999),
  primary key (family_id, product_id),
  foreign key (family_id, product_id, unit) references public.products(family_id, id, unit),
  check (unit not in ('unidad', 'paquete') or quantity = trunc(quantity))
);
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  unit text not null check (unit in ('unidad', 'kg', 'litro', 'paquete')),
  quantity numeric(7,3) not null check (quantity > 0 and quantity <= 9999),
  purchased_at timestamptz not null default now(),
  purchased_by uuid not null,
  foreign key (family_id, product_id) references public.products(family_id, id),
  foreign key (family_id, purchased_by) references public.family_members(family_id, user_id),
  check (unit not in ('unidad', 'paquete') or quantity = trunc(quantity))
);
create index purchases_family_date_idx on public.purchases(family_id, purchased_at desc);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.products enable row level security;
alter table public.pending_items enable row level security;
alter table public.purchases enable row level security;

revoke all on public.families, public.family_members, public.family_invites,
  public.products, public.pending_items, public.purchases from public, anon, authenticated;
grant select on public.families, public.family_members, public.products,
  public.pending_items, public.purchases to authenticated;
-- Invitaciones: sin lectura ni escritura directa. Solo se usan mediante RPC.
create policy family_read on public.families for select to authenticated
  using (id = (select private.current_family_id()));
create policy members_read on public.family_members for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy products_read on public.products for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy pending_read on public.pending_items for select to authenticated
  using (family_id = (select private.current_family_id()));
create policy purchases_read on public.purchases for select to authenticated
  using (family_id = (select private.current_family_id()));

create function public.create_family(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_family uuid;
begin
  if v_user is null then raise exception 'Se requiere iniciar sesión'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists (select 1 from public.family_members where user_id = v_user) then
    raise exception 'Ya pertenecés a una familia';
  end if;
  insert into public.families(name, owner_id) values (btrim(p_name), v_user) returning id into v_family;
  insert into public.family_members(user_id, family_id, display_name) values (v_user, v_family, btrim(p_display_name));
  return v_family;
end $$;

create function public.create_family_invite() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_family uuid; v_token uuid;
begin
  if v_user is null then raise exception 'Se requiere iniciar sesión'; end if;
  select id into v_family from public.families where owner_id = v_user and id = private.current_family_id();
  if v_family is null then raise exception 'Solo la persona responsable puede invitar'; end if;
  insert into public.family_invites(family_id) values (v_family)
    on conflict (family_id) do update set token = gen_random_uuid(), expires_at = now() + interval '7 days'
    returning token into v_token;
  return v_token;
end $$;

create function public.join_family(p_token uuid, p_display_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_family uuid;
begin
  if v_user is null then raise exception 'Se requiere iniciar sesión'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists (select 1 from public.family_members where user_id = v_user) then
    raise exception 'Ya pertenecés a una familia';
  end if;
  select family_id into v_family from public.family_invites
    where token = p_token and expires_at > now() for update;
  if v_family is null then raise exception 'Invitación inválida, usada o vencida'; end if;
  insert into public.family_members(user_id, family_id, display_name) values (v_user, v_family, btrim(p_display_name));
  delete from public.family_invites where token = p_token;
  return v_family;
end $$;

revoke all on function public.create_family(text, text) from public, anon;
revoke all on function public.create_family_invite() from public, anon;
revoke all on function public.join_family(uuid, text) from public, anon;
revoke all on function public.product_name_key(text) from public, anon;
grant execute on function public.create_family(text, text), public.create_family_invite(),
  public.join_family(uuid, text), public.product_name_key(text) to authenticated;

commit;
