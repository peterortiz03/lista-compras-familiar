begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','admin@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','author@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','member@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_family('Familia A','Responsable');
select set_config('test.family',private.current_family_id()::text,true);
select set_config('test.invite',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.invite')::uuid,'Autor histórico');
select public.mutate_shopping(gen_random_uuid(),'add','{"name":"Leche","unit":"litro","quantity":2,"note":"Descremada"}');
select public.mutate_shopping(gen_random_uuid(),'buy',(select jsonb_build_object('productId',product_id,'quantity',1,'version',version) from public.pending_items));
select set_config('test.product',(select id::text from public.products),true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('test.invite',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.join_family(current_setting('test.invite')::uuid,'Integrante');
do $$ declare v_payload jsonb;v_request uuid:=gen_random_uuid(); begin
 v_payload:=(select jsonb_build_object('productId',id,'favorite',true,'revision',revision) from public.products);
 perform public.mutate_shopping(v_request,'catalog_favorite',v_payload);
 perform public.mutate_shopping(v_request,'catalog_favorite',v_payload);
 if not (select favorite from public.products) then raise exception 'Favorito no persistido'; end if;
 begin perform public.manage_family('remove','11111111-1111-4111-8111-111111111111');raise exception 'Integrante pudo quitar al responsable';exception when insufficient_privilege then null;end;
 begin perform public.get_family_invite();raise exception 'Integrante pudo leer invitación';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 begin perform public.manage_family('leave');raise exception 'Responsable abandonó familia';exception when invalid_parameter_value then null;end;
 begin perform public.manage_family('remove','11111111-1111-4111-8111-111111111111');raise exception 'Responsable se quitó';exception when invalid_parameter_value then null;end;
end $$;
select public.create_family_invite();
select public.manage_family('revoke_invite');
do $$ begin if public.get_family_invite() is not null then raise exception 'Invitación no revocada';end if;end $$;
select public.manage_family('remove','22222222-2222-4222-8222-222222222222');
do $$ begin
 if public.get_family_shopping()->>'schemaVersion'<>'3' or public.get_family_shopping()->>'featuresVersion'<>'5' then raise exception 'Contrato incompatible con el cliente publicado'; end if;
 if (public.get_family_shopping()->'history'->0->>'author')<>'Autor histórico' then raise exception 'Historial perdió autor';end if;
 if (public.get_family_shopping()->'pending'->0->>'addedByName')<>'Autor histórico' then raise exception 'Pendiente perdió autor';end if;
 if (select count(*) from public.purchases)<>1 then raise exception 'Se perdió historial';end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from public.products) or exists(select 1 from public.purchases) then raise exception 'Eliminado lee datos';end if;
 begin perform public.get_family_shopping();raise exception 'Eliminado lee snapshot';exception when insufficient_privilege then null;end;
 begin perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"No permitido","unit":"unidad","quantity":1}');raise exception 'Eliminado escribe';exception when insufficient_privilege then null;end;
end $$;
select public.create_family('Familia B','Autor histórico');
do $$ begin if jsonb_array_length(public.get_family_shopping()->'history')<>0 then raise exception 'Historial pasó a otra familia';end if;end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.manage_family('leave');
reset role;
do $$ begin
 if (select count(*) from auth.users where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'))<>3 then raise exception 'Se borraron cuentas';end if;
 if (select count(*) from public.purchases where family_id=current_setting('test.family')::uuid)<>1 then raise exception 'Se perdió compra histórica';end if;
end $$;
-- Simula una familia calculada antes de revocar: la comprobación posterior al bloqueo debe rechazarla.
create or replace function private.current_family_id() returns uuid language sql stable security definer set search_path='' as $$ select current_setting('test.family')::uuid $$;
set local role authenticated;
do $$ begin
 begin perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"Carrera","unit":"unidad","quantity":1}');raise exception 'Una familia obsoleta permitió escribir';exception when insufficient_privilege then null;end;
end $$;
rollback;
