-- Después de 0008. Al aplicar solo se añade capacidad. No borra registros.
begin;

alter table public.purchases add column voided boolean not null default false
  check (not voided or reverted_at is not null);

-- También invalida el historial y las estadísticas cuando se elimina una compra.
create or replace function private.touch_purchase_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.families set purchase_revision=gen_random_uuid()
    where id=case when tg_op='DELETE' then old.family_id else new.family_id end;
  return null;
end $$;
create trigger purchases_delete_revision after delete on public.purchases
 for each row execute function private.touch_purchase_revision();

alter function public.get_family_list(uuid) set schema private;
alter function private.get_family_list(uuid) rename to get_family_list_v8;
create function public.get_family_list(p_stats_revision uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.get_family_list_v8(p_stats_revision) || jsonb_build_object('featuresVersion',9)
$$;
revoke all on function public.get_family_list(uuid) from public,anon;
grant execute on function public.get_family_list(uuid) to authenticated;

create or replace function public.get_family_purchase_period(
 p_start date,p_end date,p_before_at timestamptz default null,p_before_id uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 v_family uuid:=private.current_family_id();
 v_start timestamptz;
 v_end timestamptz;
 v_entries jsonb;
 v_older date;
begin
 if v_family is null then raise exception 'Sin acceso familiar' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_end-p_start not between 1 and 7
    or (p_before_at is null) <> (p_before_id is null) then
   raise exception 'Período inválido' using errcode='22023';
 end if;
 v_start:=p_start::timestamp at time zone 'America/Argentina/Buenos_Aires';
 v_end:=p_end::timestamp at time zone 'America/Argentina/Buenos_Aires';
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'unit',unit,
   'quantity',quantity,'purchasedAt',purchased_at,'purchasedBy',purchased_by,'author',purchased_by_name,
   'note',note,'revertedAt',reverted_at,'revertedBy',reverted_by,'voided',voided) order by purchased_at desc,id desc),'[]')
 into v_entries from (
   select * from public.purchases
   where family_id=v_family and purchased_at>=v_start and purchased_at<v_end
     and (p_before_at is null or (purchased_at,id)<(p_before_at,p_before_id))
   order by purchased_at desc,id desc limit 101
 ) page;
 select (purchased_at at time zone 'America/Argentina/Buenos_Aires')::date into v_older
 from public.purchases where family_id=v_family and purchased_at<v_start
 order by purchased_at desc,id desc limit 1;
 return jsonb_build_object('purchases',v_entries,'olderDay',v_older);
end $$;

alter function public.mutate_shopping(uuid,text,jsonb) set schema private;
alter function private.mutate_shopping(uuid,text,jsonb) rename to mutate_shopping_v8;
revoke all on function private.mutate_shopping_v8(uuid,text,jsonb) from public,anon,authenticated;

create function public.mutate_shopping(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_family uuid:=private.current_family_id();
 v_user uuid:=auth.uid();
 v_owner uuid;
 v_purchase uuid;
 v_previous private.shopping_operations%rowtype;
 v_result jsonb:='{"kind":"ok"}';
begin
 if p_action is distinct from 'void_purchase' and p_action is distinct from 'delete_purchase' then
   return private.mutate_shopping_v8(p_request_id,p_action,p_payload);
 end if;
 select owner_id into v_owner from public.families where id=v_family for update;
 if v_user is null or v_owner is distinct from v_user
    or not exists(select 1 from public.family_members where family_id=v_family and user_id=v_user) then
   raise exception 'Solo el responsable de la familia' using errcode='42501';
 end if;
 if p_request_id is null or jsonb_typeof(p_payload->'purchaseId') is distinct from 'string'
    or p_payload->'confirmed' is distinct from 'true'::jsonb then
   raise exception 'Confirmación requerida' using errcode='22023';
 end if;
 v_purchase:=(p_payload->>'purchaseId')::uuid;
 select * into v_previous from private.shopping_operations where family_id=v_family and request_id=p_request_id;
 if found then
   if v_previous.user_id<>v_user or v_previous.action<>p_action or v_previous.payload<>p_payload then
     raise exception 'Solicitud reutilizada' using errcode='22023';
   end if;
   return v_previous.result;
 end if;
 if not exists(select 1 from public.purchases where family_id=v_family and id=v_purchase) then
   raise exception 'Compra inexistente o sin acceso' using errcode='42501';
 end if;
 if p_action='void_purchase' then
   update public.purchases set reverted_at=now(),reverted_by=v_user,voided=true
   where family_id=v_family and id=v_purchase and reverted_at is null;
   if not found then raise exception 'La compra ya fue corregida' using errcode='40001'; end if;
 else
   delete from public.purchases where family_id=v_family and id=v_purchase;
 end if;
 insert into private.shopping_operations(family_id,request_id,user_id,action,payload,result)
 values(v_family,p_request_id,v_user,p_action,p_payload,v_result);
 return v_result;
end $$;

revoke all on function public.mutate_shopping(uuid,text,jsonb) from public,anon;
grant execute on function public.mutate_shopping(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
