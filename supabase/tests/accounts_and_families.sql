-- Ejecutar DESPUÉS de la migración, como postgres en SQL Editor.
-- Los usuarios de prueba y todos sus datos se descartan con ROLLBACK.
begin;
insert into auth.users(id, email) values
 ('11111111-1111-4111-8111-111111111111', 'test-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222', 'test-b@example.invalid'),
 ('33333333-3333-4333-8333-333333333333', 'test-c@example.invalid'),
 ('44444444-4444-4444-8444-444444444444', 'test-d@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.create_family('Familia A', 'Ana');
select set_config('test.family_a', (select id::text from public.families), true);
select set_config('test.old_invite', public.create_family_invite()::text, true);
select set_config('test.invite', public.create_family_invite()::text, true);

do $$ begin
  if (select count(*) from public.families) <> 1 then raise exception 'Familia propia no visible'; end if;
  begin
    perform public.create_family('Otra familia', 'Ana');
    raise exception 'Se permitió tener dos familias';
  exception when raise_exception then
    if sqlerrm = 'Se permitió tener dos familias' then raise; end if;
  end;
  begin
    insert into public.family_members(user_id, family_id, display_name)
      values ('22222222-2222-4222-8222-222222222222', current_setting('test.family_a')::uuid, 'Intruso');
    raise exception 'Se permitió insertar integrantes directamente';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select public.create_family('Familia B', 'Bruno');
do $$ begin
  if exists (select 1 from public.families where id = current_setting('test.family_a')::uuid) then raise exception 'Familia ajena visible'; end if;
  if exists (select 1 from public.family_members where user_id = '11111111-1111-4111-8111-111111111111') then raise exception 'Integrante ajeno visible'; end if;
end $$;

-- Agregamos datos como administrador para comprobar todas las políticas de lectura.
reset role;
insert into public.products(id, family_id, name, unit) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_setting('test.family_a')::uuid, 'Café', 'paquete');
insert into public.pending_items(family_id, product_id, unit, quantity) values
 (current_setting('test.family_a')::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'paquete', 2);
insert into public.purchases(family_id, product_id, name, unit, quantity, purchased_by) values
 (current_setting('test.family_a')::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Café', 'paquete', 1, '11111111-1111-4111-8111-111111111111');
set local role authenticated;
do $$ begin
  if exists (select 1 from public.products) or exists (select 1 from public.pending_items) or exists (select 1 from public.purchases) then raise exception 'Datos de compras ajenas visibles'; end if;
end $$;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
do $$ begin
  begin
    perform public.join_family(current_setting('test.old_invite')::uuid, 'Carla');
    raise exception 'Se aceptó una invitación reemplazada';
  exception when raise_exception then
    if sqlerrm = 'Se aceptó una invitación reemplazada' then raise; end if;
  end;
end $$;
select public.join_family(current_setting('test.invite')::uuid, 'Carla');
do $$ begin
  if (select count(*) from public.family_members) <> 2 then raise exception 'No se ven los dos integrantes'; end if;
  if (select count(*) from public.products) <> 1 or (select count(*) from public.pending_items) <> 1 or (select count(*) from public.purchases) <> 1 then raise exception 'Los datos propios no son visibles'; end if;
  begin
    perform public.create_family_invite();
    raise exception 'Un integrante no responsable pudo invitar';
  exception when raise_exception then
    if sqlerrm = 'Un integrante no responsable pudo invitar' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
do $$ begin
  begin
    perform public.join_family(current_setting('test.invite')::uuid, 'Diego');
    raise exception 'Una invitación se usó dos veces';
  exception when raise_exception then
    if sqlerrm = 'Una invitación se usó dos veces' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('test.expired', public.create_family_invite()::text, true);
reset role;
update public.family_invites set expires_at = now() - interval '1 minute' where token = current_setting('test.expired')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
do $$ begin
  begin
    perform public.join_family(current_setting('test.expired')::uuid, 'Diego');
    raise exception 'Se aceptó una invitación vencida';
  exception when raise_exception then
    if sqlerrm = 'Se aceptó una invitación vencida' then raise; end if;
  end;
end $$;

set local role anon;
do $$ begin
  begin
    perform public.create_family('Intruso', 'Sin sesión');
    raise exception 'Se permitió crear una familia sin sesión';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.families;
    raise exception 'Se permitió leer familias sin sesión';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.create_family('Sin identidad', 'Intruso');
    raise exception 'Se aceptó authenticated sin usuario';
  exception when raise_exception then
    if sqlerrm = 'Se aceptó authenticated sin usuario' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if public.product_name_key('  CAFÉ  MOLIDO ') <> 'cafe molido' then raise exception 'Normalización incorrecta'; end if;
end $$;
rollback;
