-- Preparada para revisión. NO ejecutar en producción sin autorización.
-- Requiere 0001–0005. No borra productos, compras ni objetos de otros buckets.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-photos','product-photos',false,262144,array['image/webp']);

create table private.product_photo_files (
  path text primary key,
  family_id uuid not null references public.families(id),
  product_id uuid not null,
  created_by uuid not null references auth.users(id),
  expected_revision uuid,
  is_new boolean not null,
  state text not null default 'staged' check (state in ('staged','active','garbage','cleaned')),
  expires_at timestamptz not null default now()+interval '1 hour',
  unique(family_id,product_id,path)
);
create index product_photo_cleanup_idx on private.product_photo_files(family_id,state,expires_at);
revoke all on private.product_photo_files from public,anon,authenticated;
alter table public.products add column photo_path text;
alter table public.products add constraint product_photo_reference foreign key(family_id,id,photo_path)
  references private.product_photo_files(family_id,product_id,path);

-- Solo rutas emitidas por el servidor: no se confía en carpetas elegidas por el cliente.
create function private.product_photo_access(p_path text,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.product_photo_files f
 where f.path=p_path and f.family_id=private.current_family_id() and auth.uid() is not null and
 case p_operation
 when 'read' then (f.state in ('garbage','cleaned') or (f.state='active' and exists(
   select 1 from public.products p where p.family_id=f.family_id and p.id=f.product_id and p.photo_path=f.path)))
 when 'insert' then f.state='staged' and f.created_by=auth.uid() and f.expires_at>now()
 when 'delete' then f.state in ('garbage','cleaned')
 else false end)
$$;
revoke all on function private.product_photo_access(text,text) from public,anon;
grant execute on function private.product_photo_access(text,text) to authenticated;

create policy product_photo_read on storage.objects for select to authenticated
 using(bucket_id='product-photos' and private.product_photo_access(name,'read'));
create policy product_photo_insert on storage.objects for insert to authenticated
 with check(bucket_id='product-photos' and private.product_photo_access(name,'insert'));
create policy product_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='product-photos' and private.product_photo_access(name,'delete'));
-- Estas restricciones impiden que una política permisiva genérica abra este bucket.
create policy product_photo_read_guard on storage.objects as restrictive for select to authenticated
 using(bucket_id<>'product-photos' or private.product_photo_access(name,'read'));
create policy product_photo_insert_guard on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'product-photos' or private.product_photo_access(name,'insert'));
create policy product_photo_delete_guard on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'product-photos' or private.product_photo_access(name,'delete'));
create policy product_photo_no_overwrite on storage.objects as restrictive for update to public
 using(bucket_id<>'product-photos') with check(bucket_id<>'product-photos');
create policy product_photo_no_anonymous on storage.objects as restrictive for all to anon
 using(bucket_id<>'product-photos') with check(bucket_id<>'product-photos');

create function public.begin_product_photo(p_product_id uuid,p_revision uuid,p_new boolean default false) returns text
language plpgsql security definer set search_path='' as $$
declare v_family uuid:=private.current_family_id(); v_path text;
begin
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
 v_path:=v_family::text||'/'||p_product_id::text||'/'||gen_random_uuid()::text||'.webp';
 insert into private.product_photo_files(path,family_id,product_id,created_by,expected_revision,is_new)
 values(v_path,v_family,p_product_id,auth.uid(),p_revision,p_new);
 return v_path;
end $$;

-- Amplía la API, manteniendo intactas las operaciones históricas.
alter function public.mutate_shopping(uuid,text,jsonb) set schema private;
alter function private.mutate_shopping(uuid,text,jsonb) rename to mutate_shopping_v5;
revoke all on function private.mutate_shopping_v5(uuid,text,jsonb) from public,anon,authenticated;
create function public.mutate_shopping(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
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
     and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint between 1 and 262144) then
     raise exception 'La carga todavía no está disponible' using errcode='22023'; end if;
   update private.product_photo_files set state='active' where path=v_path;
 elsif not (p_payload->>'removePhoto')::boolean then v_path:=v_old;
 end if;
 update public.products set name=v_name,category=p_payload->>'category',photo_path=v_path,revision=gen_random_uuid() where id=v_id and family_id=v_family;
 if v_old is not null and v_old is distinct from v_path then update private.product_photo_files set state='garbage' where path=v_old; end if;
 insert into private.shopping_operations(family_id,request_id,user_id,action,payload,result) values(v_family,p_request_id,v_user,p_action,p_payload,'{"kind":"ok"}');
 return '{"kind":"ok"}';
end $$;

-- Una carga abandonada se puede limpiar aunque el navegador se cierre o el usuario sea expulsado.
create function private.collect_product_photo_cleanup(p_family uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 update private.product_photo_files set state='garbage' where (p_family is null or family_id=p_family) and state='staged' and expires_at<=now();
 return coalesce((select jsonb_agg(path) from (select f.path from private.product_photo_files f
   where (p_family is null or f.family_id=p_family) and (f.state='garbage' or (f.state='cleaned' and exists(
     select 1 from storage.objects o where o.bucket_id='product-photos' and o.name=f.path)))
   order by f.expires_at,f.path limit 50) q),'[]');
end $$;
create function public.get_product_photo_cleanup() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_family uuid:=private.current_family_id();
begin
 perform 1 from public.families where id=v_family for update;
 if auth.uid() is null or not exists(select 1 from public.family_members where family_id=v_family and user_id=auth.uid()) then raise exception 'Sin acceso' using errcode='42501'; end if;
 return private.collect_product_photo_cleanup(v_family);
end $$;
create function public.ack_product_photo_cleanup(p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update private.product_photo_files set state='cleaned' where path=p_path and state in ('garbage','cleaned')
   and family_id=private.current_family_id() and auth.uid() is not null
   and not exists(select 1 from storage.objects where bucket_id='product-photos' and name=p_path);
end $$;
-- RPC exclusivas para el trabajador de limpieza, nunca accesibles desde React.
create function public.get_all_product_photo_cleanup() returns jsonb
language sql security definer set search_path='' as $$ select private.collect_product_photo_cleanup(null) $$;
create function public.ack_all_product_photo_cleanup(p_path text) returns void
language sql security definer set search_path='' as $$
 update private.product_photo_files set state='cleaned' where path=p_path and state in ('garbage','cleaned')
   and not exists(select 1 from storage.objects where bucket_id='product-photos' and name=p_path)
$$;
revoke all on function private.collect_product_photo_cleanup(uuid) from public,anon,authenticated;
revoke all on function public.get_all_product_photo_cleanup(),public.ack_all_product_photo_cleanup(text) from public,anon,authenticated;
grant execute on function public.get_all_product_photo_cleanup(),public.ack_all_product_photo_cleanup(text) to service_role;
revoke all on function public.begin_product_photo(uuid,uuid,boolean),public.mutate_shopping(uuid,text,jsonb),public.get_product_photo_cleanup(),public.ack_product_photo_cleanup(text) from public,anon;
grant execute on function public.begin_product_photo(uuid,uuid,boolean),public.mutate_shopping(uuid,text,jsonb),public.get_product_photo_cleanup(),public.ack_product_photo_cleanup(text) to authenticated;

-- Mantiene el contrato base y añade solo capacidades/campos opcionales.
alter function public.get_family_shopping() set schema private;
alter function private.get_family_shopping() rename to get_family_shopping_v5;
revoke all on function private.get_family_shopping_v5() from public,anon;
grant execute on function private.get_family_shopping_v5() to authenticated;
create function public.get_family_shopping() returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.get_family_shopping_v5() || jsonb_build_object('featuresVersion',6,'photoStorage',true,
 'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'active',active,'revision',revision,'category',category,'favorite',favorite,'photoPath',photo_path) order by name,id)
 from public.products where family_id=private.current_family_id()),'[]'::jsonb))
$$;
revoke all on function public.get_family_shopping() from public,anon;
grant execute on function public.get_family_shopping() to authenticated;
notify pgrst,'reload schema';
commit;
