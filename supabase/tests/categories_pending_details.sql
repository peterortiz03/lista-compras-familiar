begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','details@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.create_family('Familia detalles','Ana');
do $$
declare v_id uuid; v_purchase uuid; v_result jsonb; v_payload jsonb; v_request uuid:=gen_random_uuid();
begin
  v_result:=public.mutate_shopping(gen_random_uuid(),'add','{"name":"Bifes","unit":"kg","quantity":1,"category":"Carnes y pescados","note":"De lomo, finitos","urgent":true,"addedByName":"Falso"}');
  v_id:=(v_result->'product'->>'id')::uuid;
  if (select category from public.products where id=v_id)<>'Carnes y pescados' then raise exception 'Categoría no guardada'; end if;
  if (select added_by_name from public.pending_items where product_id=v_id)<>'Ana' then raise exception 'Autor no derivado de la sesión'; end if;
  v_payload:=jsonb_build_object('productId',v_id,'quantity',2,'version',(select version from public.pending_items where product_id=v_id));
  perform public.mutate_shopping(v_request,'update',v_payload);
  perform public.mutate_shopping(v_request,'update',v_payload);
  perform public.mutate_shopping(gen_random_uuid(),'buy',jsonb_build_object('productId',v_id,'quantity',0.5,'version',(select version from public.pending_items where product_id=v_id)));
  if (select note from public.pending_items where product_id=v_id)<>'De lomo, finitos' or not (select urgent from public.pending_items where product_id=v_id) then raise exception 'Parcial perdió detalles'; end if;
  if (select note from public.purchases limit 1)<>'De lomo, finitos' then raise exception 'Historial perdió nota'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'add','{"name":"BIFES","unit":"kg","quantity":1,"note":"No reemplazar","category":"Otros"}');
  if (select note from public.pending_items where product_id=v_id)<>'De lomo, finitos' then raise exception 'Duplicado reemplazó nota'; end if;
  if (select category from public.products where id=v_id)<>'Carnes y pescados' then raise exception 'Duplicado reclasificó'; end if;
  perform public.mutate_shopping(gen_random_uuid(),'update',jsonb_build_object('productId',v_id,'quantity',1.5,'note','','urgent',false,'version',(select version from public.pending_items where product_id=v_id)));
  if (select note from public.pending_items where product_id=v_id)<>'' then raise exception 'No se limpió nota'; end if;
  if (public.get_family_shopping()->>'schemaVersion')<>'4' then raise exception 'Esquema incorrecto'; end if;
  begin
    perform public.mutate_shopping(gen_random_uuid(),'add',jsonb_build_object('name','Inválido','unit','unidad','quantity',1,'note',repeat('a',301)));
    raise exception 'Se aceptó nota demasiado larga';
  exception when invalid_parameter_value then null; end;
end $$;
rollback;
