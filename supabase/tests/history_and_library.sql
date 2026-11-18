-- Ejecutar únicamente en una base de pruebas después de 0008.
begin;
insert into auth.users(id,email) values
 ('81111111-1111-4111-8111-111111111111','history@example.invalid'),
 ('82222222-2222-4222-8222-222222222222','second@example.invalid'),
 ('83333333-3333-4333-8333-333333333333','other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
select set_config('test.family',public.create_family('Historial','Ana')::text,true);
select set_config('test.invite',public.create_family_invite()::text,true);
select public.mutate_shopping(gen_random_uuid(),'add','{"name":"Leche","unit":"litro","quantity":3,"note":"Descremada"}');
select public.mutate_shopping(gen_random_uuid(),'buy',(
 select jsonb_build_object('productId',product_id,'quantity',1,'version',version) from public.pending_items
));
select set_config('test.library','{"products":[{"id":"leche","name":"Leche","unit":"unidad","category":"Otros"},{"id":"cafe","name":"Café","unit":"paquete","category":"Almacén"}]}',true);
do $$
declare request uuid:=gen_random_uuid(); result jsonb;
begin
 result:=public.mutate_shopping(request,'catalog_library',current_setting('test.library')::jsonb);
 if result->>'added'<>'1' or result->>'skipped'<>'1' then raise exception 'Importación incorrecta'; end if;
 if public.mutate_shopping(request,'catalog_library',current_setting('test.library')::jsonb)<>result then
   raise exception 'Reintento no idempotente'; end if;
 if (select unit from public.products where name='Leche')<>'litro'
    or (select quantity from public.pending_items)<>2 then raise exception 'El catálogo o pendiente anterior cambió'; end if;
end $$;
select set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.invite')::uuid,'Bruno');
do $$
declare result jsonb; payload jsonb; item public.products%rowtype;
begin
 result:=public.mutate_shopping(gen_random_uuid(),'catalog_library',current_setting('test.library')::jsonb);
 if result->>'added'<>'0' or result->>'skipped'<>'2' then raise exception 'Segundo integrante duplicó productos'; end if;
 select * into item from public.products where name='Café';
 perform public.mutate_shopping(gen_random_uuid(),'catalog_archive',jsonb_build_object('productId',item.id,'revision',item.revision));
 perform public.mutate_shopping(gen_random_uuid(),'catalog_library',current_setting('test.library')::jsonb);
 select * into item from public.products where id=item.id;
 if item.active then raise exception 'Recuperó automáticamente'; end if;
 payload:=jsonb_build_object('products',jsonb_build_array(jsonb_build_object(
   'id','cafe','name','Café','restoreId',item.id,'revision',item.revision)));
 result:=public.mutate_shopping(gen_random_uuid(),'catalog_library',payload);
 if result->>'restored'<>'1' then raise exception 'No recuperó selección explícita'; end if;
end $$;

reset role;
-- Dos compras en lados opuestos de medianoche local y 102 compras con fecha idéntica.
update public.purchases set purchased_at='2026-11-18T02:59:59.999999Z';
insert into public.purchases(family_id,product_id,name,unit,quantity,purchased_at,purchased_by,note)
 select p.family_id,p.id,p.name,p.unit,1,'2026-11-18T03:00:00Z',
 '81111111-1111-4111-8111-111111111111','Descremada'
 from public.products p cross join generate_series(1,102) where p.name='Leche';
set local role authenticated;
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
do $$
declare first_page jsonb; more jsonb; cursor_row jsonb; state jsonb; changed jsonb;
begin
 first_page:=public.get_family_purchase_period('2026-11-18','2026-11-19');
 if jsonb_array_length(first_page->'purchases')<>101 or first_page->>'olderDay'<>'2026-11-17' then
   raise exception 'Corte de medianoche o límite incorrecto'; end if;
 cursor_row:=first_page->'purchases'->99;
 more:=public.get_family_purchase_period('2026-11-18','2026-11-19',(cursor_row->>'purchasedAt')::timestamptz,(cursor_row->>'id')::uuid);
 if jsonb_array_length(more->'purchases')<>2 or more->'purchases'->0->>'id'<>first_page->'purchases'->100->>'id' then
   raise exception 'Cursor con empate perdió o repitió registros'; end if;
 if jsonb_array_length(public.get_family_purchase_period('2026-11-17','2026-11-18')->'purchases')<>1 then
   raise exception 'No recuperó la compra del día anterior'; end if;
 state:=public.get_family_list();
 if state->'history'<>'[]'::jsonb or state->'purchaseStats'->0->>'count'<>'103' then raise exception 'Resumen incorrecto'; end if;
 if public.get_family_list((state->>'purchaseRevision')::uuid)->'purchaseStats'<>'null'::jsonb then
   raise exception 'Reenvió estadísticas sin cambios'; end if;
 perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',jsonb_build_object('purchaseId',cursor_row->>'id'));
 changed:=public.get_family_list((state->>'purchaseRevision')::uuid);
 if changed->>'purchaseRevision'=state->>'purchaseRevision' or changed->'purchaseStats'->0->>'count'<>'102' then
   raise exception 'Reversión no invalidó el resumen'; end if;
 if (select quantity from public.pending_items)<>3 then raise exception 'Reversión no restituyó el pendiente'; end if;
end $$;
select set_config('request.jwt.claim.sub','83333333-3333-4333-8333-333333333333',true);
select public.create_family('Aislada','Otra persona');
do $$ begin
 if public.get_family_purchase_period('2026-11-17','2026-11-19')->'purchases'<>'[]'::jsonb
    or public.get_family_list()->'catalog'<>'[]'::jsonb then raise exception 'Datos de otra familia'; end if;
end $$;
rollback;
