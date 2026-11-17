-- Ejecutar como postgres después de 0001 y 0002. Todo se descarta al terminar.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','shared-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','shared-b@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','shared-c@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_family('Familia compartida','Ana');
select set_config('test.token',public.create_family_invite()::text,true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.join_family(current_setting('test.token')::uuid,'Bruno');

do $$
declare v_id uuid; v_version uuid; v_result jsonb; v_payload jsonb; v_request uuid := gen_random_uuid();
begin
  v_result := public.mutate_shopping(gen_random_uuid(),'add','{"name":" Café ","unit":"paquete","quantity":5}');
  if v_result->>'kind' <> 'added' then raise exception 'No se agregó'; end if;
  v_id := (v_result->'product'->>'id')::uuid;
  v_result := public.mutate_shopping(gen_random_uuid(),'add','{"name":"CAFE","unit":"unidad","quantity":1}');
  if v_result->>'kind' <> 'duplicate' or (select count(*) from public.pending_items) <> 1 then raise exception 'Duplicado no prevenido'; end if;
  select version into v_version from public.pending_items where product_id=v_id;
  v_payload := jsonb_build_object('productId',v_id,'quantity',3,'version',v_version);
  perform public.mutate_shopping(v_request,'buy',v_payload);
  perform public.mutate_shopping(v_request,'buy',v_payload);
  if (select quantity from public.pending_items where product_id=v_id) <> 2 or (select count(*) from public.purchases) <> 1 then raise exception 'Reintento duplicó compra o resta incorrecta'; end if;
  if (public.get_family_shopping()->'history'->0->>'author') <> 'Bruno' then raise exception 'Autor incorrecto'; end if;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'update',jsonb_build_object('productId',v_id,'quantity',9,'version',v_version));
    raise exception 'Se permitió editar una versión vieja';
  exception when serialization_failure then null; end;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'buy',v_payload);
    raise exception 'Se permitió comprar una versión vieja';
  exception when serialization_failure then null; end;
  select version into v_version from public.pending_items where product_id=v_id;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'quantity',3,'version',v_version));
    raise exception 'Se permitió comprar más que lo pendiente';
  exception when invalid_parameter_value then null; end;
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'quantity',2,'version',v_version));
  if exists(select 1 from public.pending_items) or (select count(*) from public.purchases)<>2 then raise exception 'Compra completa incorrecta'; end if;
  -- Al reponer el mismo producto cambia su versión; no se puede quitar con la vieja.
  perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"Café","unit":"paquete","quantity":1}');
  begin
    perform public.mutate_shopping(gen_random_uuid(),'remove',jsonb_build_object('productId',v_id,'version',v_version));
    raise exception 'Se permitió eliminar una reposición con versión vieja';
  exception when serialization_failure then null; end;
  select version into v_version from public.pending_items where product_id=v_id;
  perform public.mutate_shopping(gen_random_uuid(),'remove',jsonb_build_object('productId',v_id,'version',v_version));
  if (select count(*) from public.purchases)<>2 then raise exception 'Eliminar generó historial'; end if;
  perform set_config('test.product_id',v_id::text,true);
  -- Decimales exactos y rechazo de precisión excesiva.
  v_result := public.mutate_shopping(gen_random_uuid(),'add','{"name":"Leche","unit":"litro","quantity":0.3}');
  v_id := (v_result->'product'->>'id')::uuid;
  select version into v_version from public.pending_items where product_id=v_id;
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'quantity',0.1,'version',v_version));
  if (select quantity from public.pending_items where product_id=v_id)<>0.2 then raise exception 'Resto decimal incorrecto'; end if;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"Huevos","unit":"unidad","quantity":1.5}');
    raise exception 'Se aceptaron fracciones de unidades';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"Queso","unit":"kg","quantity":0.0001}');
    raise exception 'Se aceptaron más de tres decimales';
  exception when invalid_parameter_value then null; end;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  if jsonb_array_length(public.get_family_shopping()->'history')<>3 then raise exception 'Otro integrante no ve las compras'; end if;
end $$;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.create_family('Otra familia','Carla');
do $$
declare v_request uuid := gen_random_uuid(); v_payload jsonb := '{"products":[{"name":"Arroz","unit":"paquete","quantity":2},{"name":"Pan","unit":"unidad","quantity":null}]}';
begin
  if jsonb_array_length(public.get_family_shopping()->'catalog')<>0 then raise exception 'Catálogo ajeno visible'; end if;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'remove',jsonb_build_object('productId',current_setting('test.product_id'),'version',gen_random_uuid()));
    raise exception 'Se permitió modificar producto ajeno';
  exception when insufficient_privilege then null; end;
  perform public.mutate_shopping(v_request,'import',v_payload);
  perform public.mutate_shopping(v_request,'import',v_payload);
  if (select count(*) from public.products)<>2 or (select count(*) from public.pending_items)<>1 then raise exception 'Importación incorrecta'; end if;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'import',v_payload);
    raise exception 'Se permitió importar dos veces';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.pending_items(family_id,product_id,unit,quantity) select family_id,id,unit,2 from public.products limit 1;
    raise exception 'Se permitió escribir sin RPC';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.mutate_shopping(gen_random_uuid(),'add','{}');
    raise exception 'Se permitió modificar sin sesión';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
