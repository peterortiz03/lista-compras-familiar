-- Etapa A. Aplicar SOLO con aprobación explícita en producción, después de 0003.
begin;
alter table public.products add column category text not null default 'Otros'
  check (category in ('Lácteos y huevos','Carnes y pescados','Frutas y verduras','Panadería','Almacén','Bebidas','Congelados','Snacks y golosinas','Limpieza','Higiene personal','Hogar y descartables','Mascotas','Farmacia y cuidado','Otros'));
alter table public.pending_items add column note text not null default '' check (char_length(note)<=300);
alter table public.pending_items add column urgent boolean not null default false;
alter table public.pending_items add column added_by uuid references auth.users(id);
alter table public.pending_items add column added_by_name text not null default 'Integrante anterior';
alter table public.pending_items add column added_at timestamptz;
alter table public.purchases add column note text not null default '' check (char_length(note)<=300);

create function private.pending_author_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.added_by := auth.uid();
  select display_name into new.added_by_name from public.family_members where user_id=auth.uid() and family_id=new.family_id;
  new.added_by_name := coalesce(new.added_by_name,'Integrante anterior');
  new.added_at := now();
  return new;
end $$;
create trigger pending_author_before_insert before insert on public.pending_items for each row execute function private.pending_author_snapshot();
create function private.purchase_note_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select note into new.note from public.pending_items where family_id=new.family_id and product_id=new.product_id;
  new.note := coalesce(new.note,'');
  return new;
end $$;
create trigger purchase_note_before_insert before insert on public.purchases for each row execute function private.purchase_note_snapshot();
revoke all on function private.pending_author_snapshot(),private.purchase_note_snapshot() from public,anon,authenticated;

alter function public.mutate_shopping(uuid,text,jsonb) set schema private;
alter function private.mutate_shopping(uuid,text,jsonb) rename to mutate_shopping_v3;
revoke all on function private.mutate_shopping_v3(uuid,text,jsonb) from public,anon,authenticated;
create function public.mutate_shopping(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_family uuid:=private.current_family_id(); v_result jsonb; v_id uuid; v_pending boolean; v_known boolean; v_entry jsonb;
begin
  if auth.uid() is null or v_family is null then raise exception 'Sin familia autorizada' using errcode='42501'; end if;
  perform 1 from public.families where id=v_family for update;
  -- La función anterior verifica usuario, acción y payload de solicitudes repetidas.
  if exists(select 1 from private.shopping_operations where family_id=v_family and request_id=p_request_id) then
    return private.mutate_shopping_v3(p_request_id,p_action,p_payload);
  end if;
  if p_action in ('add','update') then
    if p_payload ? 'note' and (jsonb_typeof(p_payload->'note') is distinct from 'string' or char_length(p_payload->>'note')>300) then raise exception 'Nota inválida' using errcode='22023'; end if;
    if p_payload ? 'urgent' and jsonb_typeof(p_payload->'urgent') is distinct from 'boolean' then raise exception 'Prioridad inválida' using errcode='22023'; end if;
  end if;
  if p_action='revert_purchase' then
    select product_id into v_id from public.purchases where family_id=v_family and id=(p_payload->>'purchaseId')::uuid;
    v_pending:=exists(select 1 from public.pending_items where family_id=v_family and product_id=v_id);
  end if;
  v_known:=exists(select 1 from public.products where family_id=v_family and name_key=public.product_name_key(p_payload->>'name'));
  v_result:=private.mutate_shopping_v3(p_request_id,p_action,p_payload);
  if p_action='add' and v_result->>'kind'='added' then
    v_id:=(v_result->'product'->>'id')::uuid;
    update public.pending_items set note=coalesce(btrim(p_payload->>'note'),''),urgent=coalesce((p_payload->>'urgent')::boolean,false) where family_id=v_family and product_id=v_id;
    -- Un producto conocido conserva su categoría. Solo el alta nueva puede asignarla aquí.
    if p_payload ? 'category' and not v_known then
      update public.products set category=p_payload->>'category' where id=v_id and family_id=v_family;
    end if;
  elsif p_action='update' then
    update public.pending_items set note=case when p_payload ? 'note' then btrim(p_payload->>'note') else note end,
      urgent=case when p_payload ? 'urgent' then (p_payload->>'urgent')::boolean else urgent end
      where family_id=v_family and product_id=(p_payload->>'productId')::uuid;
  elsif p_action='revert_purchase' and not v_pending then
    update public.pending_items set note=(select note from public.purchases where id=(p_payload->>'purchaseId')::uuid)
      where family_id=v_family and product_id=v_id;
  end if;
  if p_action='import' then
    for v_entry in select value from jsonb_array_elements(p_payload->'products') loop
      if v_entry ? 'category' then
        update public.products set category=v_entry->>'category' where family_id=v_family and name_key=public.product_name_key(v_entry->>'name');
      end if;
      if v_entry ? 'note' and (jsonb_typeof(v_entry->'note') is distinct from 'string' or char_length(v_entry->>'note')>300) then raise exception 'Nota inválida' using errcode='22023'; end if;
      if v_entry ? 'urgent' and jsonb_typeof(v_entry->'urgent') is distinct from 'boolean' then raise exception 'Prioridad inválida' using errcode='22023'; end if;
      update public.pending_items i set note=coalesce(btrim(v_entry->>'note'),''),urgent=coalesce((v_entry->>'urgent')::boolean,false)
        from public.products p where i.family_id=v_family and p.family_id=v_family and i.product_id=p.id and p.name_key=public.product_name_key(v_entry->>'name');
    end loop;
  end if;
  if p_action in ('catalog_add','catalog_update') and p_payload ? 'category' then
    if jsonb_typeof(p_payload->'category') is distinct from 'string' then raise exception 'Categoría inválida' using errcode='22023'; end if;
    update public.products set category=p_payload->>'category' where family_id=v_family
      and (case when p_action='catalog_add' then name_key=public.product_name_key(p_payload->>'name') else id=(p_payload->>'productId')::uuid end);
  end if;
  return v_result;
end $$;

alter function public.get_family_shopping() set schema private;
alter function private.get_family_shopping() rename to get_family_shopping_v3;
-- Es invoker y sigue sometida a RLS; solo la API pública se expone a PostgREST.
create function public.get_family_shopping() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.get_family_shopping_v3() || jsonb_build_object('schemaVersion',4,
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'active',active,'revision',revision,'category',category) order by name,id) from public.products where family_id=private.current_family_id()),'[]'::jsonb),
    'pending',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity,'version',version,'note',note,'urgent',urgent,'addedBy',added_by,'addedByName',added_by_name,'addedAt',added_at) order by product_id) from public.pending_items where family_id=private.current_family_id()),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(entry || jsonb_build_object('note',p.note) order by p.purchased_at desc,p.id)
      from jsonb_array_elements(private.get_family_shopping_v3()->'history') entry
      join public.purchases p on p.id=(entry->>'id')::uuid where p.family_id=private.current_family_id()),'[]'::jsonb))
$$;
revoke all on function public.mutate_shopping(uuid,text,jsonb),public.get_family_shopping() from public,anon;
grant execute on function public.mutate_shopping(uuid,text,jsonb),public.get_family_shopping() to authenticated;
notify pgrst,'reload schema';
commit;
