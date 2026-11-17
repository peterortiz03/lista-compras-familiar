-- B y C. Requiere aprobación antes de producción. Conserva cuentas e historial.
begin;
alter table public.products add column favorite boolean not null default false;
alter table public.purchases add column purchased_by_name text not null default 'Integrante anterior';
update public.purchases p set purchased_by_name=m.display_name from public.family_members m where m.family_id=p.family_id and m.user_id=p.purchased_by;
alter table public.purchases drop constraint purchases_family_id_purchased_by_fkey;
alter table public.purchases add constraint purchases_author_auth_fk foreign key(purchased_by) references auth.users(id);

create function private.purchase_author_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select display_name into new.purchased_by_name from public.family_members where family_id=new.family_id and user_id=new.purchased_by;
  new.purchased_by_name:=coalesce(new.purchased_by_name,'Integrante anterior'); return new;
end $$;
create trigger purchase_author_before_insert before insert on public.purchases for each row execute function private.purchase_author_snapshot();
revoke all on function private.purchase_author_snapshot() from public,anon,authenticated;

alter function public.mutate_shopping(uuid,text,jsonb) set schema private;
alter function private.mutate_shopping(uuid,text,jsonb) rename to mutate_shopping_v4;
revoke all on function private.mutate_shopping_v4(uuid,text,jsonb) from public,anon,authenticated;
create function public.mutate_shopping(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_family uuid:=private.current_family_id();v_product public.products%rowtype;v_previous private.shopping_operations%rowtype;v_result jsonb;v_entry jsonb;
begin
  if v_user is null or v_family is null then raise exception 'Sin acceso familiar' using errcode='42501'; end if;
  perform 1 from public.families where id=v_family for update;
  -- Nueva consulta tras adquirir el bloqueo: no confiar en la membresía previa a la espera.
  if not exists(select 1 from public.family_members where family_id=v_family and user_id=v_user) then raise exception 'Acceso revocado' using errcode='42501'; end if;
  if p_action<>'catalog_favorite' then
    if exists(select 1 from private.shopping_operations where family_id=v_family and request_id=p_request_id) then
      return private.mutate_shopping_v4(p_request_id,p_action,p_payload);
    end if;
    v_result:=private.mutate_shopping_v4(p_request_id,p_action,p_payload);
    if p_action='import' then
      for v_entry in select value from jsonb_array_elements(p_payload->'products') loop
        if v_entry ? 'favorite' then
          if jsonb_typeof(v_entry->'favorite') is distinct from 'boolean' then raise exception 'Favorito inválido' using errcode='22023'; end if;
          update public.products set favorite=(v_entry->>'favorite')::boolean where family_id=v_family and name_key=public.product_name_key(v_entry->>'name');
        end if;
      end loop;
    end if;
    return v_result;
  end if;
  if p_request_id is null or jsonb_typeof(p_payload->'favorite') is distinct from 'boolean' then raise exception 'Solicitud inválida' using errcode='22023'; end if;
  select * into v_previous from private.shopping_operations where family_id=v_family and request_id=p_request_id;
  if found then
    if v_previous.user_id<>v_user or v_previous.action<>p_action or v_previous.payload<>p_payload then raise exception 'Solicitud reutilizada' using errcode='22023'; end if;
    return v_previous.result;
  end if;
  select * into v_product from public.products where family_id=v_family and id=(p_payload->>'productId')::uuid;
  if not found then raise exception 'Producto ajeno' using errcode='42501'; end if;
  if v_product.revision is distinct from (p_payload->>'revision')::uuid then raise exception 'El catálogo cambió' using errcode='40001'; end if;
  update public.products set favorite=(p_payload->>'favorite')::boolean,revision=gen_random_uuid() where id=v_product.id;
  v_result:='{"kind":"ok"}';
  insert into private.shopping_operations(family_id,request_id,user_id,action,payload,result) values(v_family,p_request_id,v_user,p_action,p_payload,v_result);
  return v_result;
end $$;

create or replace function public.get_family_shopping() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_family uuid:=private.current_family_id();
begin
  if v_family is null or auth.uid() is null then raise exception 'Sin acceso familiar' using errcode='42501'; end if;
  -- Sobre estable para el cliente publicado en 0003; capacidades aditivas por separado.
  return jsonb_build_object('schemaVersion',3,'featuresVersion',5,
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'active',active,'revision',revision,'category',category,'favorite',favorite) order by name,id) from public.products where family_id=v_family),'[]'::jsonb),
    'pending',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity,'version',version,'note',note,'urgent',urgent,'addedBy',added_by,'addedByName',added_by_name,'addedAt',added_at) order by product_id) from public.pending_items where family_id=v_family),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'unit',unit,'quantity',quantity,'purchasedAt',purchased_at,'purchasedBy',purchased_by,'author',purchased_by_name,'note',note,'revertedAt',reverted_at,'revertedBy',reverted_by) order by purchased_at desc,id) from public.purchases where family_id=v_family),'[]'::jsonb));
end $$;

create function public.manage_family(p_action text,p_user_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_family uuid:=private.current_family_id();v_owner uuid;
begin
  if v_user is null or v_family is null then raise exception 'Sin acceso familiar' using errcode='42501'; end if;
  select owner_id into v_owner from public.families where id=v_family for update;
  if not exists(select 1 from public.family_members where user_id=v_user and family_id=v_family) then raise exception 'Acceso revocado' using errcode='42501'; end if;
  if p_action='leave' then
    if v_owner=v_user then raise exception 'El responsable no puede abandonarse' using errcode='22023'; end if;
    delete from public.family_members where user_id=v_user and family_id=v_family;
  elsif p_action='remove' then
    if v_owner<>v_user then raise exception 'Solo el responsable' using errcode='42501'; end if;
    if p_user_id is null or p_user_id=v_owner then raise exception 'No se puede eliminar al responsable' using errcode='22023'; end if;
    delete from public.family_members where user_id=p_user_id and family_id=v_family;
    if found then delete from public.family_invites where family_id=v_family; end if;
  elsif p_action='revoke_invite' then
    if v_owner<>v_user then raise exception 'Solo el responsable' using errcode='42501'; end if;
    delete from public.family_invites where family_id=v_family;
  else raise exception 'Operación inválida' using errcode='22023'; end if;
end $$;

create or replace function public.join_family(p_token uuid,p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_family uuid;
begin
  if v_user is null then raise exception 'Se requiere sesión' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select family_id into v_family from public.family_invites where token=p_token and expires_at>now();
  if v_family is null then raise exception 'Invitación inválida'; end if;
  perform 1 from public.families where id=v_family for update;
  if exists(select 1 from public.family_members where user_id=v_user) then raise exception 'Ya pertenecés a una familia'; end if;
  if not exists(select 1 from public.family_invites where family_id=v_family and token=p_token and expires_at>now()) then raise exception 'Invitación inválida'; end if;
  insert into public.family_members(user_id,family_id,display_name) values(v_user,v_family,btrim(p_display_name));
  delete from public.family_invites where token=p_token;
  return v_family;
end $$;

create function public.get_family_invite() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_family uuid:=private.current_family_id();v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.families where id=v_family and owner_id=auth.uid()) then raise exception 'Solo el responsable' using errcode='42501'; end if;
  select jsonb_build_object('token',token,'expiresAt',expires_at) into v_result from public.family_invites where family_id=v_family;
  return v_result;
end $$;
create or replace function public.create_family_invite() returns uuid
language plpgsql security definer set search_path='' as $$
declare v_family uuid:=private.current_family_id();v_token uuid;
begin
  perform 1 from public.families where id=v_family for update;
  if auth.uid() is null or not exists(select 1 from public.family_members m join public.families f on f.id=m.family_id where m.user_id=auth.uid() and f.id=v_family and f.owner_id=auth.uid()) then raise exception 'Solo el responsable' using errcode='42501'; end if;
  insert into public.family_invites(family_id) values(v_family) on conflict(family_id) do update set token=gen_random_uuid(),expires_at=now()+interval '7 days' returning token into v_token;
  return v_token;
end $$;
revoke all on function public.mutate_shopping(uuid,text,jsonb),public.manage_family(text,uuid),public.get_family_invite() from public,anon;
grant execute on function public.mutate_shopping(uuid,text,jsonb),public.manage_family(text,uuid),public.get_family_invite() to authenticated;
notify pgrst,'reload schema';
commit;
