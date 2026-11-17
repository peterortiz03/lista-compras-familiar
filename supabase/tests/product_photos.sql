-- Solo base de pruebas: metadata ficticia como la que escribe Storage; ROLLBACK final.
begin;
-- Incluso si otro bucket utiliza una política demasiado amplia, las restricciones protegen fotos.
create policy product_photo_test_broad on storage.objects to authenticated,anon using(true) with check(true);
insert into auth.users(id,email) values
 ('61111111-1111-4111-8111-111111111111','photo-owner@example.invalid'),
 ('62222222-2222-4222-8222-222222222222','photo-member@example.invalid'),
 ('63333333-3333-4333-8333-333333333333','photo-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
select public.create_family('Fotos A','Ana');
select set_config('test.family',private.current_family_id()::text,true);
select set_config('test.invite',public.create_family_invite()::text,true);
select public.mutate_shopping(gen_random_uuid(),'add','{"name":"Leche anterior","unit":"litro","quantity":2,"note":"Descremada","urgent":true}');
select set_config('test.product',(select id::text from public.products),true);
select set_config('test.revision',(select revision::text from public.products),true);
select set_config('test.path',public.begin_product_photo(current_setting('test.product')::uuid,current_setting('test.revision')::uuid,false),true);
insert into storage.objects(bucket_id,name,metadata) values('product-photos',current_setting('test.path'),'{"mimetype":"image/webp","size":1234}');
do $$ begin
 if (select count(*) from storage.objects where bucket_id='product-photos')<>0 then raise exception 'Foto en preparación visible'; end if;
end $$;
select set_config('test.payload',jsonb_build_object('productId',current_setting('test.product'),'name','Leche anterior','unit','litro','category','Lácteos y huevos','isNew',false,'revision',current_setting('test.revision'),'photoPath',current_setting('test.path'),'removePhoto',false)::text,true);
select set_config('test.request',gen_random_uuid()::text,true);
select public.mutate_shopping(current_setting('test.request')::uuid,'catalog_save_photo',current_setting('test.payload')::jsonb);
select public.mutate_shopping(current_setting('test.request')::uuid,'catalog_save_photo',current_setting('test.payload')::jsonb);
do $$ begin
 if (select photo_path from public.products)<>current_setting('test.path') then raise exception 'Foto no asociada'; end if;
 if (select quantity from public.pending_items)<>2 or not (select urgent from public.pending_items) then raise exception 'Pendiente alterado'; end if;
 delete from storage.objects where name=current_setting('test.path');
 if not exists(select 1 from storage.objects where name=current_setting('test.path')) then raise exception 'Se pudo borrar foto activa'; end if;
 update storage.objects set metadata='{"size":1}' where name=current_setting('test.path');
 if (select metadata->>'size' from storage.objects where name=current_setting('test.path'))<>'1234' then raise exception 'Se pudo sobrescribir foto activa'; end if;
 begin perform public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',current_setting('test.payload')::jsonb); raise exception 'No detectó revisión obsoleta'; exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.invite')::uuid,'Bruno');
do $$ begin
 if not exists(select 1 from storage.objects where name=current_setting('test.path')) then raise exception 'Integrante no ve foto'; end if;
 begin perform public.get_all_product_photo_cleanup(); raise exception 'Integrante accedió trabajador'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','63333333-3333-4333-8333-333333333333',true);
select public.create_family('Fotos B','Carla');
do $$ begin
 if exists(select 1 from storage.objects where name=current_setting('test.path')) then raise exception 'Filtración entre familias'; end if;
 begin insert into storage.objects(bucket_id,name,metadata) values('product-photos',current_setting('test.family')||'/arbitrary.webp','{}'); raise exception 'Carga ajena permitida'; exception when insufficient_privilege then null; end;
 if public.get_product_photo_cleanup()<>'[]'::jsonb then raise exception 'Cola ajena visible'; end if;
end $$;
select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
select set_config('test.revision',(select revision::text from public.products),true);
select set_config('test.path2',public.begin_product_photo(current_setting('test.product')::uuid,current_setting('test.revision')::uuid,false),true);
do $$ begin
 begin perform public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',jsonb_build_object('productId',current_setting('test.product'),'name','NO DEBE CAMBIAR','category','Otros','isNew',false,'revision',current_setting('test.revision'),'photoPath',current_setting('test.path2'),'removePhoto',false)); raise exception 'Aceptó archivo ausente'; exception when invalid_parameter_value then null; end;
 if (select name from public.products)<>'Leche anterior' or (select photo_path from public.products)<>current_setting('test.path') then raise exception 'Reemplazo fallido alteró producto'; end if;
end $$;
insert into storage.objects(bucket_id,name,metadata) values('product-photos',current_setting('test.path2'),'{"mimetype":"image/webp","size":1400}');
select public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',jsonb_build_object('productId',current_setting('test.product'),'name','Leche anterior','category','Lácteos y huevos','isNew',false,'revision',current_setting('test.revision'),'photoPath',current_setting('test.path2'),'removePhoto',false));
do $$ begin
 if not (public.get_product_photo_cleanup() ? current_setting('test.path')) then raise exception 'Foto anterior no encolada'; end if;
end $$;
delete from storage.objects where name=current_setting('test.path'); -- solo metadata ficticia; producción usa API Storage
select public.ack_product_photo_cleanup(current_setting('test.path'));
select public.mutate_shopping(gen_random_uuid(),'catalog_save_photo',jsonb_build_object('productId',current_setting('test.product'),'name','Leche anterior','category','Lácteos y huevos','isNew',false,'revision',(select revision from public.products),'photoPath',null,'removePhoto',true));
do $$ begin
 if (select photo_path from public.products) is not null then raise exception 'No quitó foto'; end if;
 if not (public.get_product_photo_cleanup() ? current_setting('test.path2')) then raise exception 'Foto quitada no encolada'; end if;
 if (public.get_family_shopping()->>'featuresVersion')::int<>6 then raise exception 'Capacidades incorrectas'; end if;
end $$;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
-- TTL y reaparición tardía: el registro conserva rutas pendientes de eliminación.
select set_config('test.abandoned',public.begin_product_photo(current_setting('test.product')::uuid,(select revision from public.products),false),true);
reset role;
update private.product_photo_files set expires_at=now()-interval '1 minute' where path=current_setting('test.abandoned');
set local role authenticated;
do $$ begin
 if not (public.get_product_photo_cleanup() ? current_setting('test.abandoned')) then raise exception 'Carga abandonada no encolada'; end if;
end $$;
select public.ack_product_photo_cleanup(current_setting('test.abandoned'));
reset role;
insert into storage.objects(bucket_id,name,metadata) values('product-photos',current_setting('test.abandoned'),'{"mimetype":"image/webp","size":10}');
set local role authenticated;
do $$ begin
 if not (public.get_product_photo_cleanup() ? current_setting('test.abandoned')) then raise exception 'Objeto tardío no reencolado'; end if;
end $$;
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='product-photos') then raise exception 'Anónimo ve fotos'; end if;
end $$;
set local role authenticated;
select public.manage_family('remove','62222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='product-photos') then raise exception 'Expulsado ve foto'; end if;
 begin perform public.begin_product_photo(current_setting('test.product')::uuid,current_setting('test.revision')::uuid,false); raise exception 'Expulsado carga foto'; exception when insufficient_privilege then null; end;
end $$;
rollback;
