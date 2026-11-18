-- Ejecutar en una base temporal con 0009. Todas las compras son ficticias.
begin;
insert into auth.users(id,email) values
 ('91111111-1111-4111-8111-111111111111','owner@example.invalid'),
 ('92222222-2222-4222-8222-222222222222','member@example.invalid'),
 ('93333333-3333-4333-8333-333333333333','outsider@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
select public.create_family('Administración','Ana');
select set_config('test.invite',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','92222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.invite')::uuid,'Bruno');
select public.mutate_shopping(gen_random_uuid(),'add','{"name":"Tomates","unit":"kg","quantity":4,"note":"Maduros"}');
select public.mutate_shopping(gen_random_uuid(),'buy',(
 select jsonb_build_object('productId',product_id,'quantity',1,'version',version) from public.pending_items
));
select set_config('test.purchase',(select id::text from public.purchases),true);
select set_config('test.payload',jsonb_build_object('purchaseId',current_setting('test.purchase'),'confirmed',true)::text,true);
do $$ begin
   begin
     perform public.mutate_shopping(gen_random_uuid(),'void_purchase',current_setting('test.payload')::jsonb);
     raise exception 'Integrante pudo anular su compra';
   exception when insufficient_privilege then null; end;
   begin
     perform public.mutate_shopping(gen_random_uuid(),'delete_purchase',current_setting('test.payload')::jsonb);
     raise exception 'Integrante pudo eliminar su compra';
   exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','93333333-3333-4333-8333-333333333333',true);
select public.create_family('Otra familia','Carla');
do $$ begin
 begin
   perform public.mutate_shopping(gen_random_uuid(),'delete_purchase',current_setting('test.payload')::jsonb);
   raise exception 'Responsable pudo eliminar una compra ajena';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
do $$
declare
 v_snapshot jsonb;
 v_period jsonb;
 v_request uuid:=gen_random_uuid();
 v_payload jsonb:=current_setting('test.payload')::jsonb;
 v_today date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 begin
   perform public.mutate_shopping(gen_random_uuid(),'delete_purchase',v_payload-'confirmed');
   raise exception 'Permitió eliminar sin confirmar';
 exception when invalid_parameter_value then null; end;
 v_snapshot:=public.get_family_list();
 if v_snapshot->>'featuresVersion'<>'9' or v_snapshot->'purchaseStats'->0->>'count'<>'1' then
   raise exception 'Vista de lista no compatible';
 end if;
 perform public.mutate_shopping(v_request,'void_purchase',v_payload);
 perform public.mutate_shopping(v_request,'void_purchase',v_payload);
 v_snapshot:=public.get_family_list((v_snapshot->>'purchaseRevision')::uuid);
 if v_snapshot->'purchaseStats'<>'[]'::jsonb or (select quantity from public.pending_items)<>3 then
   raise exception 'Anular cambió pendientes o no descontó estadísticas';
 end if;
 v_period:=public.get_family_purchase_period(v_today,v_today+1);
 if v_period->'purchases'->0->>'voided'<>'true' or v_period->'purchases'->0->>'note'<>'Maduros' then
   raise exception 'Anulación sin marca o con pérdida de nota';
 end if;
 perform public.mutate_shopping(gen_random_uuid(),'revert_purchase',v_payload-'confirmed');
 if (select quantity from public.pending_items)<>3 then raise exception 'Revirtió una compra anulada'; end if;
 v_request:=gen_random_uuid();
 perform public.mutate_shopping(v_request,'delete_purchase',v_payload);
 perform public.mutate_shopping(v_request,'delete_purchase',v_payload);
 if exists(select 1 from public.purchases) or (select quantity from public.pending_items)<>3
   or public.get_family_list()->>'purchaseRevision'=v_snapshot->>'purchaseRevision'
   or public.get_family_purchase_period(v_today,v_today+1)->'purchases'<>'[]'::jsonb then
   raise exception 'Borrado o invalidación incorrectos';
 end if;
 perform public.mutate_shopping(gen_random_uuid(),'buy',(
   select jsonb_build_object('productId',product_id,'quantity',1,'version',version) from public.pending_items
 ));
 v_snapshot:=public.get_family_list();
 perform public.mutate_shopping(gen_random_uuid(),'delete_purchase',(
   select jsonb_build_object('purchaseId',id,'confirmed',true) from public.purchases
 ));
 if public.get_family_list((v_snapshot->>'purchaseRevision')::uuid)->'purchaseStats'<>'[]'::jsonb
   or (select quantity from public.pending_items)<>2 then
   raise exception 'Borrar compra vigente cambió pendientes o dejó estadísticas';
 end if;
end $$;
rollback;
