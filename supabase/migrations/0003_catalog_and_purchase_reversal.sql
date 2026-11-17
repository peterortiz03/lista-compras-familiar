-- Después de 0001 y 0002. Conserva productos, pendientes e historial existentes.
begin;
alter table public.products add column active boolean not null default true;
alter table public.products add column revision uuid not null default gen_random_uuid();
alter table public.purchases add column reverted_at timestamptz;
alter table public.purchases add column reverted_by uuid references auth.users(id);
alter table public.purchases add constraint purchase_reversal_pair
  check ((reverted_at is null) = (reverted_by is null));

-- Conservamos las operaciones de la entrega anterior, sin permitir invocarlas directamente.
alter function public.mutate_shopping(uuid, text, jsonb) set schema private;
alter function private.mutate_shopping(uuid, text, jsonb) rename to mutate_shopping_v2;
revoke all on function private.mutate_shopping_v2(uuid, text, jsonb) from public, anon, authenticated;

create function public.mutate_shopping(p_request_id uuid, p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := private.current_family_id();
  v_owner uuid;
  v_product public.products%rowtype;
  v_purchase public.purchases%rowtype;
  v_previous private.shopping_operations%rowtype;
  v_quantity numeric;
  v_name text;
  v_result jsonb := '{"kind":"ok"}'::jsonb;
begin
  if v_user is null or v_family is null then raise exception 'Se requiere una cuenta con familia' using errcode = '42501'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Solicitud inválida' using errcode = '22023'; end if;
  select owner_id into v_owner from public.families where id = v_family for update;
  select * into v_previous from private.shopping_operations where family_id = v_family and request_id = p_request_id;
  if found then
    if v_previous.user_id <> v_user or v_previous.action is distinct from p_action or v_previous.payload <> p_payload then
      raise exception 'Solicitud reutilizada' using errcode = '22023';
    end if;
    return v_previous.result;
  end if;

  if p_action in ('add', 'update', 'remove', 'buy', 'import') then
    if p_action = 'add' then
      update public.products set active = true, revision = gen_random_uuid()
        where family_id = v_family and not active and name_key = public.product_name_key(p_payload->>'name');
    end if;
    v_result := private.mutate_shopping_v2(p_request_id, p_action, p_payload);
    if p_action = 'import' then
      update public.products p set active = false, revision = gen_random_uuid() where p.family_id = v_family
        and exists (select 1 from jsonb_array_elements(p_payload->'products') e
          where e->>'active' = 'false' and public.product_name_key(e->>'name') = p.name_key);
    end if;
    return v_result;
  elsif p_action = 'catalog_add' then
    v_name := regexp_replace(btrim(p_payload->>'name'), '\s+', ' ', 'g');
    if v_name is null or char_length(btrim(v_name)) not between 1 and 80 then raise exception 'Nombre inválido' using errcode = '22023'; end if;
    perform private.check_quantity(1, p_payload->>'unit');
    insert into public.products(family_id, name, unit) values (v_family, v_name, p_payload->>'unit');
  elsif p_action in ('catalog_update', 'catalog_archive', 'catalog_restore') then
    select * into v_product from public.products where family_id = v_family and id = (p_payload->>'productId')::uuid;
    if not found then raise exception 'Producto ajeno o inexistente' using errcode = '42501'; end if;
    if v_product.revision is distinct from (p_payload->>'revision')::uuid then
      raise exception 'El producto cambió. Revisá el catálogo antes de editar.' using errcode = '40001';
    end if;
    if p_action = 'catalog_update' then
      v_name := regexp_replace(btrim(p_payload->>'name'), '\s+', ' ', 'g');
      if v_name is null or char_length(btrim(v_name)) not between 1 and 80 then raise exception 'Nombre inválido' using errcode = '22023'; end if;
      update public.products set name = v_name, revision = gen_random_uuid() where id = v_product.id;
    else
      update public.products set active = (p_action = 'catalog_restore'), revision = gen_random_uuid() where id = v_product.id;
    end if;
  elsif p_action = 'revert_purchase' then
    select * into v_purchase from public.purchases where family_id = v_family and id = (p_payload->>'purchaseId')::uuid;
    if not found then raise exception 'Compra ajena o inexistente' using errcode = '42501'; end if;
    if v_purchase.purchased_by <> v_user and v_owner <> v_user then raise exception 'Solo el autor o responsable puede revertir' using errcode = '42501'; end if;
    if v_purchase.reverted_at is null then
      select * into v_product from public.products where id = v_purchase.product_id and family_id = v_family;
      if v_product.unit <> v_purchase.unit then raise exception 'La unidad original cambió' using errcode = '40001'; end if;
      select quantity into v_quantity from public.pending_items where family_id = v_family and product_id = v_purchase.product_id;
      v_quantity := coalesce(v_quantity, 0) + v_purchase.quantity;
      perform private.check_quantity(v_quantity, v_purchase.unit);
      insert into public.pending_items(family_id, product_id, unit, quantity)
        values (v_family, v_purchase.product_id, v_purchase.unit, v_quantity)
        on conflict (family_id, product_id) do update set quantity = excluded.quantity, version = gen_random_uuid();
      update public.purchases set reverted_at = now(), reverted_by = v_user where id = v_purchase.id;
    end if;
  else
    raise exception 'Operación desconocida' using errcode = '22023';
  end if;
  insert into private.shopping_operations(family_id, request_id, user_id, action, payload, result)
    values (v_family, p_request_id, v_user, p_action, p_payload, v_result);
  return v_result;
end $$;

create or replace function public.get_family_shopping() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'schemaVersion', 3,
    'catalog', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit', unit, 'active', active, 'revision', revision) order by name,id)
      from public.products where family_id = private.current_family_id()), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity,'version',version) order by product_id)
      from public.pending_items where family_id = private.current_family_id()), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'productId',p.product_id,'name',p.name,'unit',p.unit,
      'quantity',p.quantity,'purchasedAt',p.purchased_at,'purchasedBy',p.purchased_by,'author',m.display_name,
      'revertedAt',p.reverted_at,'revertedBy',p.reverted_by) order by p.purchased_at desc,p.id)
      from public.purchases p join public.family_members m on m.user_id=p.purchased_by and m.family_id=p.family_id
      where p.family_id=private.current_family_id()), '[]'::jsonb)
  )
$$;
revoke all on function public.mutate_shopping(uuid,text,jsonb) from public,anon;
grant execute on function public.mutate_shopping(uuid,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
