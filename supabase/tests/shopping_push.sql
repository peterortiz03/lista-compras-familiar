begin;
insert into auth.users(id, email) values
 ('c1111111-1111-4111-8111-111111111111','push-owner@example.invalid'),
 ('c2222222-2222-4222-8222-222222222222','push-member@example.invalid'),
 ('c3333333-3333-4333-8333-333333333333','push-other@example.invalid');

select set_config('test.push_p256dh','B'||repeat('A',86),true);
select set_config('test.push_auth',repeat('A',22),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select public.create_family('Push QA','Ana');
select set_config('test.push_invite',public.create_family_invite()::text,true);
select public.register_shopping_push('https://fcm.googleapis.com/fcm/send/owner',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);

select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.push_invite')::uuid,'Luz');
select public.register_shopping_push('https://web.push.apple.com/member',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
select public.register_shopping_push('https://updates.push.services.mozilla.com/wpush/v2/member',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
do $$ begin
 if not public.has_shopping_push('https://web.push.apple.com/member') then raise exception 'La suscripción propia no está activa'; end if;
 if public.has_shopping_push('https://fcm.googleapis.com/fcm/send/owner') then raise exception 'Se reveló la suscripción de otro integrante'; end if;
 begin
   perform public.register_shopping_push('https://fcm.googleapis.com/fcm/send/owner',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
   raise exception 'Se reasignó un dispositivo que pertenece a otra cuenta';
 exception when unique_violation then null;
 end;
 begin
   perform public.register_shopping_push('https://web.push.apple.com.example.invalid/member',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
   raise exception 'Se aceptó un proveedor que no corresponde';
 exception when check_violation then null;
 end;
 begin
   perform public.register_shopping_push('https://fcm.googleapis.com/fcm/send/expired',current_setting('test.push_p256dh'),current_setting('test.push_auth'),now()-interval '1 minute');
   raise exception 'Se aceptó una suscripción vencida';
 exception when invalid_parameter_value then null;
 end;
 begin perform public.claim_shopping_push(); raise exception 'Un cliente pudo reclamar la cola'; exception when insufficient_privilege then null; end;
 begin perform 1 from private.shopping_push_subscriptions; raise exception 'Un cliente pudo leer endpoints'; exception when insufficient_privilege then null; end;
 perform public.unregister_shopping_push('https://fcm.googleapis.com/fcm/send/owner');
end $$;

select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
select public.create_family('Otra familia','Mar');
select public.register_shopping_push('https://fcm.googleapis.com/fcm/send/other',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
do $$ begin
 if not public.has_shopping_push('https://fcm.googleapis.com/fcm/send/owner') then raise exception 'Otro integrante desactivó un dispositivo ajeno'; end if;
 if not public.start_shopping_session() then raise exception 'La compra no comenzó'; end if;
 if public.start_shopping_session() then raise exception 'Se inició un aviso duplicado'; end if;
end $$;

reset role;
do $$ begin
 if (select count(*) from private.shopping_push_deliveries) <> 2 then raise exception 'Debe haber una entrega por dispositivo elegible'; end if;
end $$;
set local role service_role;
do $$ declare
  v_delivery record;
  v_count int := 0;
begin
 for v_delivery in select * from public.claim_shopping_push() loop
   if v_delivery.display_name is distinct from 'Ana' or v_delivery.endpoint not in (
     'https://web.push.apple.com/member', 'https://updates.push.services.mozilla.com/wpush/v2/member') then
     raise exception 'Se reclamó un destinatario no autorizado';
   end if;
   v_count := v_count + 1;
   if v_delivery.endpoint = 'https://web.push.apple.com/member' then
     perform set_config('test.push_id',v_delivery.subscription_id::text,true);
     perform set_config('test.push_revision',v_delivery.revision::text,true);
   else
     perform public.invalidate_shopping_push(v_delivery.subscription_id,v_delivery.revision);
   end if;
 end loop;
 if v_count <> 2 or exists(select 1 from public.claim_shopping_push()) then raise exception 'Reclamo duplicado o incompleto'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select public.register_shopping_push('https://web.push.apple.com/member',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
set local role service_role;
select public.invalidate_shopping_push(current_setting('test.push_id')::uuid,current_setting('test.push_revision')::uuid);
set local role authenticated;
do $$ begin
 if public.has_shopping_push('https://updates.push.services.mozilla.com/wpush/v2/member') then raise exception 'Sigue activa una suscripción inválida'; end if;
 if not public.has_shopping_push('https://web.push.apple.com/member') then raise exception 'Una respuesta tardía desactivó una suscripción renovada'; end if;
 perform public.unregister_shopping_push('https://web.push.apple.com/member');
 if public.has_shopping_push('https://web.push.apple.com/member') then raise exception 'No se canceló la suscripción propia'; end if;
end $$;

select public.register_shopping_push('https://web.push.apple.com/member',current_setting('test.push_p256dh'),current_setting('test.push_auth'),null);
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select public.end_shopping_session((select id from public.shopping_sessions));
select public.start_shopping_session();
select public.end_shopping_session((select id from public.shopping_sessions));
set local role service_role;
do $$ begin
 if exists(select 1 from public.claim_shopping_push()) then raise exception 'Se intentó enviar un aviso finalizado'; end if;
end $$;
set local role authenticated;
select public.start_shopping_session();
select public.manage_family('remove','c2222222-2222-4222-8222-222222222222');
set local role service_role;
do $$ begin
 if exists(select 1 from public.claim_shopping_push()) then raise exception 'Se intentó enviar a un exintegrante'; end if;
end $$;

rollback;
