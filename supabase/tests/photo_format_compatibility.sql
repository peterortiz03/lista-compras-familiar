-- Solo entorno de pruebas; metadata ficticia, sin blobs reales.
begin;
insert into auth.users(id,email) values('71111111-1111-4111-8111-111111111111','formats@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);
select public.create_family('Formatos','Prueba');
select public.mutate_shopping(gen_random_uuid(),'catalog_add','{"name":"Aceite de oliva","unit":"unidad"}');
do $$ declare p public.products%rowtype;path text;legacy text;payload jsonb;begin
 select * into p from public.products;
 legacy:=public.begin_product_photo(p.id,p.revision,false);
 if right(legacy,5)<>'.webp' then raise exception 'Ruta anterior incompatible';end if;
 path:=public.begin_product_photo(p.id,p.revision,false,'image/jpeg');
 if right(path,4)<>'.jpg' then raise exception 'Ruta JPEG inválida';end if;
 begin perform public.begin_product_photo(p.id,p.revision,false,'image/png');raise exception 'Aceptó PNG';exception when invalid_parameter_value then null;end;
 insert into storage.objects(bucket_id,name,metadata) values('product-photos',path,'{"mimetype":"image/webp","size":1024}');
 payload:=jsonb_build_object('productId',p.id,'revision',p.revision,'isNew',false,'name',p.name,'category','Otros','photoPath',path,'removePhoto',false);
 begin perform public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',payload);raise exception 'Aceptó MIME incorrecto';exception when invalid_parameter_value then null;end;
 if (select photo_path from public.products where id=p.id) is not null then raise exception 'Falló rollback';end if;
end $$;
reset role;
update storage.objects set metadata='{"mimetype":"image/jpeg","size":1024}';
-- Recuperar la ruta staging mediante una variable guardada por el administrador de pruebas.
select set_config('test.jpeg',(select path from private.product_photo_files where expected_mime='image/jpeg'),true);
set local role authenticated;
select public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',(select jsonb_build_object('productId',id,'revision',revision,'isNew',false,'name',name,'category',category,'photoPath',current_setting('test.jpeg'),'removePhoto',false) from public.products));
do $$ begin
 if not exists(select 1 from storage.objects where name=current_setting('test.jpeg')) then raise exception 'JPEG no visible';end if;
end $$;
select public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',(select jsonb_build_object('productId',id,'revision',revision,'isNew',false,'name',name,'category',category,'photoPath',null,'removePhoto',true) from public.products));
do $$ begin
 if not(public.get_product_photo_cleanup() ? current_setting('test.jpeg')) then raise exception 'JPEG no se limpia';end if;
end $$;
rollback;
