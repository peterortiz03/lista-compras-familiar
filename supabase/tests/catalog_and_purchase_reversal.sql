-- Después de las tres migraciones, como postgres. Finaliza sin conservar datos ficticios.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','catalog-owner@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','catalog-author@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','catalog-member@example.invalid'),
 ('44444444-4444-4444-8444-444444444444','catalog-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_family('Familia A','Responsable');
select set_config('test.invite', public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.invite')::uuid,'Autor');
do $$
declare v_id uuid; v_revision uuid; v_purchase uuid; v_quantity numeric; v_result jsonb;
begin
  perform public.mutate_shopping(gen_random_uuid(),'catalog_add','{"name":"Café","unit":"paquete"}');
  if exists(select 1 from public.pending_items) then raise exception 'Crear catálogo agregó un pendiente'; end if;
  select id,revision into v_id,v_revision from public.products;
  perform public.mutate_shopping(gen_random_uuid(),'catalog_update',jsonb_build_object('productId',v_id,'revision',v_revision,'name','Café molido'));
  begin
    perform public.mutate_shopping(gen_random_uuid(),'catalog_archive',jsonb_build_object('productId',v_id,'revision',v_revision));
    raise exception 'Se permitió una revisión vieja de catálogo';
  exception when serialization_failure then null; end;
  perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"Café molido","unit":"paquete","quantity":5}');
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'version',(select version from public.pending_items where product_id=v_id),'quantity',3));
  select id into v_purchase from public.purchases;
  select revision into v_revision from public.products where id=v_id;
  perform public.mutate_shopping(gen_random_uuid(),'catalog_archive',jsonb_build_object('productId',v_id,'revision',v_revision));
  if (select active from public.products where id=v_id) or (select quantity from public.pending_items where product_id=v_id)<>2 or (select count(*) from public.purchases)<>1 then raise exception 'Quitar alteró pendientes o compras'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',v_purchase));
  perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',v_purchase));
  if (select quantity from public.pending_items where product_id=v_id)<>5 or (select reverted_at from public.purchases where id=v_purchase) is null then raise exception 'Reversión incorrecta o duplicada'; end if;
  if (select active from public.products where id=v_id) then raise exception 'Revertir reactivó un producto quitado'; end if;
  select revision into v_revision from public.products where id=v_id;
  perform public.mutate_shopping(gen_random_uuid(),'catalog_restore',jsonb_build_object('productId',v_id,'revision',v_revision));
  if not (select active from public.products where id=v_id) then raise exception 'No se recuperó'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'catalog_add','{"name":"Arroz","unit":"paquete"}');
  begin
    perform public.mutate_shopping(gen_random_uuid(),'catalog_update',jsonb_build_object('productId',v_id,'revision',(select revision from public.products where id=v_id),'name','ARROZ'));
    raise exception 'Se permitió nombre duplicado';
  exception when unique_violation then null; end;
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'version',(select version from public.pending_items where product_id=v_id),'quantity',1));
  perform set_config('test.purchase',(select id::text from public.purchases where reverted_at is null),true);
  perform set_config('test.product',v_id::text,true);
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('test.invite',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.join_family(current_setting('test.invite')::uuid,'Otro integrante');
do $$ begin
  begin
    perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',current_setting('test.purchase')));
    raise exception 'Un integrante revirtió la compra de otro';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',current_setting('test.purchase')));
do $$
declare v_purchase uuid; v_id uuid := current_setting('test.product')::uuid;
begin
  if (select quantity from public.pending_items where product_id=current_setting('test.product')::uuid)<>5 then raise exception 'El responsable no pudo revertir'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'version',(select version from public.pending_items where product_id=v_id),'quantity',5));
  select id into v_purchase from public.purchases where reverted_at is null;
  if exists(select 1 from public.pending_items where product_id=v_id) then raise exception 'Compra completa no retiró el pendiente'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',v_purchase));
  if (select quantity from public.pending_items where product_id=v_id)<>5 then raise exception 'Revertir compra completa no repuso el pendiente'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'version',(select version from public.pending_items where product_id=v_id),'quantity',1));
  select id into v_purchase from public.purchases where reverted_at is null;
  perform public.mutate_shopping(gen_random_uuid(),'update',jsonb_build_object('productId',v_id,'version',(select version from public.pending_items where product_id=v_id),'quantity',9999));
  begin
    perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',v_purchase));
    raise exception 'Revertir superó el límite de cantidad';
  exception when invalid_parameter_value then null; end;
  if (select reverted_at from public.purchases where id=v_purchase) is not null then raise exception 'Reversión fallida modificó historial'; end if;
  if (public.get_family_shopping()->>'schemaVersion')<>'3' then raise exception 'Versión de esquema incorrecta'; end if;
  begin
    perform private.mutate_shopping_v2(gen_random_uuid(),'add','{}');
    raise exception 'Se pudo invocar la función interna';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.create_family('Familia B','Ajeno');
do $$ begin
  begin
    perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',current_setting('test.purchase')));
    raise exception 'Se revirtió una compra ajena';
  exception when insufficient_privilege then null; end;
  perform public.mutate_shopping(gen_random_uuid(),'import','{"products":[{"name":"Producto quitado","unit":"unidad","quantity":2,"active":false},{"name":"Producto activo","unit":"paquete","quantity":null,"active":true}]}');
  if (select active from public.products where name='Producto quitado') then raise exception 'La importación reactivó un producto quitado'; end if;
  if (select quantity from public.pending_items)<>2 then raise exception 'La importación perdió el pendiente de un producto quitado'; end if;
end $$;
rollback;
