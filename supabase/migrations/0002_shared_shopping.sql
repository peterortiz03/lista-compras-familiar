-- Ejecutar después de 0001. No importa ni borra los datos locales del navegador.
begin;
alter table public.pending_items add column version uuid not null default gen_random_uuid();

-- Registro privado para que reintentar la misma solicitud no repita una compra.
create table private.shopping_operations (
  family_id uuid not null references public.families(id) on delete cascade,
  request_id uuid not null,
  user_id uuid not null references auth.users(id),
  action text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (family_id, request_id)
);
create table private.local_imports (
  family_id uuid primary key references public.families(id) on delete cascade,
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now()
);
revoke all on private.shopping_operations, private.local_imports from public, anon, authenticated;

create function private.check_quantity(p_quantity numeric, p_unit text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 9999 or p_quantity <> round(p_quantity, 3)
    or p_unit not in ('unidad', 'paquete', 'kg', 'litro') or p_unit is null
    or (p_unit in ('unidad', 'paquete') and p_quantity <> trunc(p_quantity)) then
    raise exception 'Cantidad o unidad inválida' using errcode = '22023';
  end if;
end $$;
revoke all on function private.check_quantity(numeric, text) from public, anon, authenticated;

create function public.get_family_shopping() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit', unit) order by name, id)
      from public.products where family_id = private.current_family_id()), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('productId', product_id, 'quantity', quantity, 'version', version) order by product_id)
      from public.pending_items where family_id = private.current_family_id()), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'productId', p.product_id, 'name', p.name,
      'unit', p.unit, 'quantity', p.quantity, 'purchasedAt', p.purchased_at,
      'purchasedBy', p.purchased_by, 'author', m.display_name) order by p.purchased_at desc, p.id)
      from public.purchases p join public.family_members m on m.user_id = p.purchased_by and m.family_id = p.family_id
      where p.family_id = private.current_family_id()), '[]'::jsonb),
    'imported', exists (select 1 from public.products where family_id = private.current_family_id())
  )
$$;

create function public.mutate_shopping(p_request_id uuid, p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := private.current_family_id();
  v_product public.products%rowtype;
  v_pending public.pending_items%rowtype;
  v_previous private.shopping_operations%rowtype;
  v_quantity numeric;
  v_name text;
  v_unit text;
  v_result jsonb := '{"kind":"ok"}'::jsonb;
  v_entry jsonb;
begin
  if v_user is null or v_family is null then raise exception 'Se requiere una cuenta con familia' using errcode = '42501'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Solicitud inválida' using errcode = '22023'; end if;
  -- Todas las escrituras de una familia se ordenan con el mismo bloqueo.
  perform 1 from public.families where id = v_family for update;
  select * into v_previous from private.shopping_operations where family_id = v_family and request_id = p_request_id;
  if found then
    if v_previous.user_id <> v_user or v_previous.action is distinct from p_action or v_previous.payload <> p_payload then
      raise exception 'Identificador de solicitud reutilizado' using errcode = '22023';
    end if;
    return v_previous.result;
  end if;

  if p_action = 'add' then
    v_name := regexp_replace(btrim(p_payload->>'name'), '\s+', ' ', 'g');
    if v_name is null or char_length(v_name) not between 1 and 80 then raise exception 'Nombre inválido' using errcode = '22023'; end if;
    select * into v_product from public.products where family_id = v_family and name_key = public.product_name_key(v_name);
    if not found then
      v_unit := p_payload->>'unit';
      perform private.check_quantity((p_payload->>'quantity')::numeric, v_unit);
      insert into public.products(family_id, name, unit) values (v_family, v_name, v_unit) returning * into v_product;
    end if;
    v_quantity := (p_payload->>'quantity')::numeric;
    perform private.check_quantity(v_quantity, v_product.unit);
    if exists (select 1 from public.pending_items where family_id = v_family and product_id = v_product.id) then
      v_result := jsonb_build_object('kind', 'duplicate');
    else
      insert into public.pending_items(family_id, product_id, unit, quantity) values (v_family, v_product.id, v_product.unit, v_quantity);
      v_result := jsonb_build_object('kind', 'added');
    end if;
    v_result := v_result || jsonb_build_object('product', jsonb_build_object('id', v_product.id, 'name', v_product.name, 'unit', v_product.unit));

  elsif p_action in ('update', 'remove', 'buy') then
    select * into v_product from public.products where family_id = v_family and id = (p_payload->>'productId')::uuid;
    if not found then raise exception 'Producto ajeno o inexistente' using errcode = '42501'; end if;
    select * into v_pending from public.pending_items where family_id = v_family and product_id = v_product.id;
    if not found or v_pending.version is distinct from (p_payload->>'version')::uuid then
      raise exception 'La lista cambió. Actualizá y revisá la cantidad antes de reintentar.' using errcode = '40001';
    end if;
    if p_action = 'remove' then
      delete from public.pending_items where family_id = v_family and product_id = v_product.id;
    else
      v_quantity := (p_payload->>'quantity')::numeric;
      perform private.check_quantity(v_quantity, v_product.unit);
      if p_action = 'buy' then
        if v_quantity > v_pending.quantity then raise exception 'La compra supera lo pendiente' using errcode = '22023'; end if;
        insert into public.purchases(family_id, product_id, name, unit, quantity, purchased_by)
          values (v_family, v_product.id, v_product.name, v_product.unit, v_quantity, v_user);
        v_quantity := v_pending.quantity - v_quantity;
      end if;
      if v_quantity = 0 then
        delete from public.pending_items where family_id = v_family and product_id = v_product.id;
      else
        update public.pending_items set quantity = v_quantity, version = gen_random_uuid() where family_id = v_family and product_id = v_product.id;
      end if;
    end if;

  elsif p_action = 'import' then
    if exists (select 1 from private.local_imports where family_id = v_family)
      or exists (select 1 from public.products where family_id = v_family)
      or exists (select 1 from public.purchases where family_id = v_family) then
      raise exception 'La importación requiere una familia vacía y solo se permite una vez' using errcode = '22023';
    end if;
    if jsonb_typeof(p_payload->'products') is distinct from 'array' then raise exception 'Catálogo inválido' using errcode = '22023'; end if;
    if jsonb_array_length(p_payload->'products') not between 1 and 500 then raise exception 'Importá entre 1 y 500 productos' using errcode = '22023'; end if;
    for v_entry in select value from jsonb_array_elements(p_payload->'products') loop
      v_name := regexp_replace(btrim(v_entry->>'name'), '\s+', ' ', 'g');
      if v_name is null or char_length(v_name) not between 1 and 80 then raise exception 'Nombre inválido' using errcode = '22023'; end if;
      v_unit := v_entry->>'unit';
      perform private.check_quantity(1, v_unit);
      insert into public.products(family_id, name, unit) values (v_family, v_name, v_unit) returning * into v_product;
      if v_entry->>'quantity' is not null then
        v_quantity := (v_entry->>'quantity')::numeric;
        perform private.check_quantity(v_quantity, v_unit);
        insert into public.pending_items(family_id, product_id, unit, quantity) values (v_family, v_product.id, v_unit, v_quantity);
      end if;
    end loop;
    insert into private.local_imports(family_id, imported_by) values (v_family, v_user);
  else
    raise exception 'Operación desconocida' using errcode = '22023';
  end if;

  insert into private.shopping_operations(family_id, request_id, user_id, action, payload, result)
    values (v_family, p_request_id, v_user, p_action, p_payload, v_result);
  return v_result;
end $$;

revoke all on function public.get_family_shopping(), public.mutate_shopping(uuid, text, jsonb) from public, anon;
grant execute on function public.get_family_shopping(), public.mutate_shopping(uuid, text, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
