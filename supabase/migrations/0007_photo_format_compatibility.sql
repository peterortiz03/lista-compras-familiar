-- Requiere 0006. Aplicar una vez SOLO con autorización en producción.
begin;
alter table private.product_photo_files add column expected_mime text not null default 'image/webp'
 check(expected_mime in ('image/webp','image/jpeg'));
update storage.buckets set allowed_mime_types=array['image/webp','image/jpeg'] where id='product-photos' and not public;
do $$ begin
 if not exists(select 1 from storage.buckets where id='product-photos' and not public and file_size_limit=262144) then
 raise exception 'Revisar bucket privado product-photos y límite 256 KiB'; end if;
end $$;
create function public.begin_product_photo(p_product_id uuid,p_revision uuid,p_new boolean,p_mime text) returns text
language plpgsql security definer set search_path='' as $$
declare v_family uuid:=private.current_family_id(); v_path text; v_extension text;
begin
 if p_mime not in ('image/webp','image/jpeg') or p_mime is null then raise exception 'Formato no permitido' using errcode='22023'; end if;
 v_extension:=case p_mime when 'image/jpeg' then '.jpg' else '.webp' end;
 perform 1 from public.families where id=v_family for update;
 if auth.uid() is null or not exists(select 1 from public.family_members where family_id=v_family and user_id=auth.uid()) then
   raise exception 'Sin acceso familiar' using errcode='42501'; end if;
 if p_product_id is null or p_new is null then raise exception 'Solicitud inválida' using errcode='22023'; end if;
 if p_new then
   if exists(select 1 from public.products where id=p_product_id) then raise exception 'Producto existente' using errcode='40001'; end if;
 elsif not exists(select 1 from public.products where id=p_product_id and family_id=v_family and revision=p_revision) then
   raise exception 'Producto cambiado o ajeno' using errcode='40001'; end if;
 if (select count(*) from private.product_photo_files where family_id=v_family and state='staged' and expires_at>now())>=20 then
   raise exception 'Demasiadas cargas pendientes; esperá una hora' using errcode='54000'; end if;
 v_path:=v_family::text||'/'||p_product_id::text||'/'||gen_random_uuid()::text||v_extension;
 insert into private.product_photo_files(path,family_id,product_id,created_by,expected_revision,is_new,expected_mime)
 values(v_path,v_family,p_product_id,auth.uid(),p_revision,p_new,p_mime);
 return v_path;
end $$;


-- Conserva la firma histórica para clientes anteriores; la nueva no tiene argumentos opcionales.
create or replace function public.begin_product_photo(p_product_id uuid,p_revision uuid,p_new boolean default false) returns text
language sql security invoker set search_path='' as $$
 select public.begin_product_photo(p_product_id,p_revision,p_new,'image/webp')
$$;
revoke all on function public.begin_product_photo(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.begin_product_photo(uuid,uuid,boolean,text) to authenticated;
create or replace function public.mutate_shopping(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_family uuid:=private.current_family_id(); v_user uuid:=auth.uid(); v_previous private.shopping_operations%rowtype;
 v_product public.products%rowtype; v_file private.product_photo_files%rowtype; v_id uuid; v_path text; v_old text; v_new boolean; v_name text;
begin
 perform 1 from public.families where id=v_family for update;
 if v_user is null or not exists(select 1 from public.family_members where family_id=v_family and user_id=v_user) then
   raise exception 'Sin acceso familiar' using errcode='42501'; end if;
 if p_action is distinct from 'catalog_save_photo' then return private.mutate_shopping_v5(p_request_id,p_action,p_payload); end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Solicitud inválida' using errcode='22023'; end if;
 select * into v_previous from private.shopping_operations where family_id=v_family and request_id=p_request_id;
 if found then
   if v_previous.user_id<>v_user or v_previous.action<>p_action or v_previous.payload<>p_payload then raise exception 'Solicitud reutilizada' using errcode='22023'; end if;
   return v_previous.result;
 end if;
 if jsonb_typeof(p_payload->'isNew') is distinct from 'boolean' or jsonb_typeof(p_payload->'removePhoto') is distinct from 'boolean' then
   raise exception 'Solicitud inválida' using errcode='22023'; end if;
 v_id:=(p_payload->>'productId')::uuid; v_new:=(p_payload->>'isNew')::boolean;
 v_name:=regexp_replace(btrim(p_payload->>'name'),'\s+',' ','g');
 if v_id is null or v_name is null or char_length(v_name) not between 1 and 80 then raise exception 'Nombre inválido' using errcode='22023'; end if;
 if v_new then
   perform private.check_quantity(1,p_payload->>'unit');
   insert into public.products(id,family_id,name,unit,category) values(v_id,v_family,v_name,p_payload->>'unit',p_payload->>'category');
 else
   select * into v_product from public.products where family_id=v_family and id=v_id;
   if not found then raise exception 'Producto ajeno' using errcode='42501'; end if;
   if v_product.revision is distinct from (p_payload->>'revision')::uuid then raise exception 'Producto cambiado' using errcode='40001'; end if;
   v_old:=v_product.photo_path;
 end if;
 v_path:=p_payload->>'photoPath';
 if v_path is not null then
   if (p_payload->>'removePhoto')::boolean then raise exception 'Operación ambigua' using errcode='22023'; end if;
   select * into v_file from private.product_photo_files where path=v_path and family_id=v_family and product_id=v_id for update;
   if not found or v_file.created_by<>v_user or v_file.state<>'staged' or v_file.expires_at<=now()
     or v_file.is_new<>v_new or v_file.expected_revision is distinct from (p_payload->>'revision')::uuid then
     raise exception 'Carga no autorizada o vencida' using errcode='42501'; end if;
   if not exists(select 1 from storage.objects where bucket_id='product-photos' and name=v_path
     and metadata->>'mimetype'=v_file.expected_mime
     and v_path like '%' || case v_file.expected_mime when 'image/jpeg' then '.jpg' else '.webp' end and (metadata->>'size')::bigint between 1 and 262144) then
     raise exception 'La carga todavía no está disponible' using errcode='22023'; end if;
   update private.product_photo_files set state='active' where path=v_path;
 elsif not (p_payload->>'removePhoto')::boolean then v_path:=v_old;
 end if;
 update public.products set name=v_name,category=p_payload->>'category',photo_path=v_path,revision=gen_random_uuid() where id=v_id and family_id=v_family;
 if v_old is not null and v_old is distinct from v_path then update private.product_photo_files set state='garbage' where path=v_old; end if;
 insert into private.shopping_operations(family_id,request_id,user_id,action,payload,result) values(v_family,p_request_id,v_user,p_action,p_payload,'{"kind":"ok"}');
 return '{"kind":"ok"}';
end $$;

notify pgrst,'reload schema';
commit;
