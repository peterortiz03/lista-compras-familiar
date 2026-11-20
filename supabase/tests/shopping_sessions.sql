begin;
insert into auth.users(id, email) values
 ('a1111111-1111-4111-8111-111111111111','shop-owner@example.invalid'),
 ('a2222222-2222-4222-8222-222222222222','shop-start@example.invalid'),
 ('a3333333-3333-4333-8333-333333333333','shop-member@example.invalid'),
 ('a4444444-4444-4444-8444-444444444444','shop-outsider@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select set_config('test.shop_family',public.create_family('Familia de prueba','Ana')::text,true);
select set_config('test.shop_invite',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.shop_invite')::uuid,'Pedro');
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select set_config('test.shop_invite',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
select public.join_family(current_setting('test.shop_invite')::uuid,'Luz');

select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
do $$ begin
 if not public.start_shopping_session() then raise exception 'No se inició la sesión'; end if;
 if public.start_shopping_session() then raise exception 'El iniciador duplicó una sesión'; end if;
 if (select expires_at - started_at from public.shopping_sessions) <> interval '90 minutes' then
   raise exception 'Duración inesperada';
 end if;
end $$;
select set_config('test.shop_first',(select id::text from public.shopping_sessions),true);

select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
do $$ begin
 if public.get_family_list()->'shoppingSession'->>'displayName' is distinct from 'Pedro' then
   raise exception 'El aviso no muestra el perfil familiar';
 end if;
 if public.start_shopping_session() then raise exception 'Un familiar duplicó la sesión'; end if;
 begin
   perform public.end_shopping_session(current_setting('test.shop_first')::uuid);
   raise exception 'Un familiar pudo finalizar la sesión ajena';
 exception when insufficient_privilege then null;
 end;
end $$;
select public.mutate_shopping(gen_random_uuid(),'add','{"name":"Leche","quantity":2,"unit":"litro"}');

select set_config('request.jwt.claim.sub','a4444444-4444-4444-8444-444444444444',true);
do $$ begin
 begin
   perform public.start_shopping_session();
   raise exception 'Se permitió iniciar una sesión sin familia';
 exception when insufficient_privilege then null;
 end;
end $$;
select public.create_family('Otra familia','Mar');
do $$ begin
 if (select count(*) from public.shopping_sessions) <> 0 or public.get_family_list()->'shoppingSession' <> 'null'::jsonb then
   raise exception 'Aviso visible desde otra familia';
 end if;
 if public.end_shopping_session(current_setting('test.shop_first')::uuid) then
   raise exception 'Otra familia finalizó el aviso';
 end if;
end $$;

select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$ begin
 if not public.end_shopping_session(current_setting('test.shop_first')::uuid) then raise exception 'El responsable no pudo finalizar'; end if;
 if (select quantity from public.pending_items) is distinct from 2::numeric then raise exception 'Se modificaron los pendientes'; end if;
end $$;
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
do $$ begin
 if not public.start_shopping_session() then raise exception 'No se pudo iniciar después de finalizar'; end if;
 if public.end_shopping_session(current_setting('test.shop_first')::uuid) then raise exception 'Se finalizó una sesión nueva con un ID anterior'; end if;
 if not public.end_shopping_session((select id from public.shopping_sessions)) then raise exception 'El iniciador no pudo finalizar su aviso'; end if;
 if not public.start_shopping_session() then raise exception 'No se pudo iniciar la sesión para probar caducidad'; end if;
end $$;
select set_config('test.shop_expiring',(select id::text from public.shopping_sessions),true);
reset role;
update public.shopping_sessions set started_at = statement_timestamp() - interval '91 minutes', expires_at = statement_timestamp() - interval '1 minute'
 where id = current_setting('test.shop_expiring')::uuid;
set local role authenticated;
do $$ begin
 if exists (select 1 from public.shopping_sessions) or public.get_family_list()->'shoppingSession' <> 'null'::jsonb then
   raise exception 'Una sesión vencida continúa visible';
 end if;
 if not public.start_shopping_session() then raise exception 'Una sesión vencida impidió iniciar otra nueva'; end if;
end $$;

select public.manage_family('leave');
reset role;
do $$ begin
 if exists (select 1 from public.shopping_sessions where family_id = current_setting('test.shop_family')::uuid) then
   raise exception 'Persiste un aviso después de abandonar la familia';
 end if;
end $$;
set local role anon;
do $$ begin
 begin
   perform public.start_shopping_session();
   raise exception 'Se permitió empezar como anónimo';
 exception when insufficient_privilege then null;
 end;
end $$;

rollback;
