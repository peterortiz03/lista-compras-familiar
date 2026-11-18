-- Después de 0007. Conserva API anterior, fotos, compras y catálogo.
begin;

alter table public.products add column library_id text
  check (library_id is null or library_id ~ '^[a-z0-9-]{1,64}$');
create unique index products_family_library_idx on public.products(family_id,library_id)
  where library_id is not null;
alter table public.families add column purchase_revision uuid not null default gen_random_uuid();
create index purchases_family_date_id_idx on public.purchases(family_id,purchased_at desc,id desc);

create function private.touch_purchase_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.families set purchase_revision=gen_random_uuid() where id=new.family_id;
  return new;
end $$;
revoke all on function private.touch_purchase_revision() from public,anon,authenticated;
create trigger purchases_revision after insert or update on public.purchases
 for each row execute function private.touch_purchase_revision();

-- Solo datos de trabajo. Las estadísticas se reenvían únicamente cuando cambian.
create function public.get_family_list(p_stats_revision uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  v_family uuid:=private.current_family_id();
  v_revision uuid;
  v_stats jsonb;
begin
  select purchase_revision into v_revision from public.families where id=v_family;
  if v_revision is null then raise exception 'Sin acceso familiar' using errcode='42501'; end if;
  if v_revision is distinct from p_stats_revision then
    select coalesce(jsonb_agg(jsonb_build_object('productId',product_id,'count',total,'lastPurchasedAt',latest)),'[]')
      into v_stats
      from (select product_id,count(*) as total,max(purchased_at) as latest
            from public.purchases where family_id=v_family and reverted_at is null group by product_id) s;
  end if;
  return jsonb_build_object('schemaVersion',3,'featuresVersion',8,'photoStorage',true,
    'purchaseRevision',v_revision,'purchaseStats',v_stats,'history','[]'::jsonb,
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'active',active,
       'revision',revision,'category',category,'favorite',favorite,'photoPath',photo_path,'libraryId',library_id) order by name,id)
       from public.products where family_id=v_family),'[]'),
    'pending',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity,
       'version',version,'note',note,'urgent',urgent,'addedBy',added_by,'addedByName',added_by_name,'addedAt',added_at) order by product_id)
       from public.pending_items where family_id=v_family),'[]'));
end $$;

-- Intervalos semiabiertos de días argentinos. El cursor conserva la precisión de PostgreSQL.
create function public.get_family_purchase_period(
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
   'note',note,'revertedAt',reverted_at,'revertedBy',reverted_by) order by purchased_at desc,id desc),'[]')
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
alter function private.mutate_shopping(uuid,text,jsonb) rename to mutate_shopping_v7;
revoke all on function private.mutate_shopping_v7(uuid,text,jsonb) from public,anon,authenticated;

create function public.mutate_shopping(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_family uuid:=private.current_family_id();
 v_user uuid:=auth.uid();
 v_previous private.shopping_operations%rowtype;
 v_product public.products%rowtype;
 v_item jsonb;
 v_id text;
 v_name text;
 v_added integer:=0;
 v_skipped integer:=0;
 v_restored integer:=0;
 v_result jsonb;
begin
 if p_action is distinct from 'catalog_library' then
   return private.mutate_shopping_v7(p_request_id,p_action,p_payload);
 end if;
 perform 1 from public.families where id=v_family for update;
 if v_user is null or not exists(select 1 from public.family_members where family_id=v_family and user_id=v_user) then
   raise exception 'Sin acceso familiar' using errcode='42501';
 end if;
 if p_request_id is null or jsonb_typeof(p_payload->'products') is distinct from 'array' then
   raise exception 'Selección inválida' using errcode='22023';
 end if;
 if jsonb_array_length(p_payload->'products') not between 1 and 200 then
   raise exception 'Selección inválida' using errcode='22023';
 end if;
 select * into v_previous from private.shopping_operations where family_id=v_family and request_id=p_request_id;
 if found then
   if v_previous.user_id<>v_user or v_previous.action<>p_action or v_previous.payload<>p_payload then
     raise exception 'Solicitud reutilizada' using errcode='22023';
   end if;
   return v_previous.result;
 end if;
 for v_item in select value from jsonb_array_elements(p_payload->'products') loop
   v_id:=v_item->>'id';
   v_name:=regexp_replace(btrim(v_item->>'name'),'\s+',' ','g');
   if v_id is null or v_id !~ '^[a-z0-9-]{1,64}$' or v_name is null or char_length(v_name) not between 1 and 80 then
     raise exception 'Producto inválido' using errcode='22023';
   end if;
   select * into v_product from public.products
   where family_id=v_family and (library_id=v_id or name_key=public.product_name_key(v_name))
   order by (library_id=v_id) desc nulls last,id limit 1;
   if v_item ? 'restoreId' then
     if found and not v_product.active and v_product.id=(v_item->>'restoreId')::uuid
        and v_product.revision=(v_item->>'revision')::uuid then
       update public.products set active=true,revision=gen_random_uuid() where id=v_product.id and family_id=v_family;
       v_restored:=v_restored+1;
     else
       v_skipped:=v_skipped+1;
     end if;
   elsif found then
     v_skipped:=v_skipped+1;
   else
     insert into public.products(family_id,name,unit,category,library_id)
        values(v_family,v_name,v_item->>'unit',v_item->>'category',v_id)
        on conflict do nothing;
     if found then v_added:=v_added+1;
     else v_skipped:=v_skipped+1; end if;
   end if;
 end loop;
 v_result:=jsonb_build_object('kind','library','added',v_added,'skipped',v_skipped,'restored',v_restored);
 insert into private.shopping_operations(family_id,request_id,user_id,action,payload,result)
 values(v_family,p_request_id,v_user,p_action,p_payload,v_result);
 return v_result;
end $$;

revoke all on function public.get_family_list(uuid),public.get_family_purchase_period(date,date,timestamptz,uuid),public.mutate_shopping(uuid,text,jsonb) from public,anon;
grant execute on function public.get_family_list(uuid),public.get_family_purchase_period(date,date,timestamptz,uuid),public.mutate_shopping(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
