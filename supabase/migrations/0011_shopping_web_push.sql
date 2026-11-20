begin;

create table private.shopping_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  expires_at timestamptz,
  revision uuid not null default gen_random_uuid(),
  foreign key (family_id, user_id) references public.family_members(family_id, user_id) on delete cascade,
  check (octet_length(endpoint) <= 2048 and endpoint !~ '[[:space:][:cntrl:]#]' and strpos(endpoint, chr(92)) = 0
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+push\.apple\.com|([a-z0-9-]+\.)+(notify|wns)\.windows\.com)/.+$'),
  check (p256dh ~ '^B[A-Za-z0-9_-]{86}$' and auth_key ~ '^[A-Za-z0-9_-]{22}$')
);
create index shopping_push_family_idx on private.shopping_push_subscriptions(family_id, user_id);

create table private.shopping_push_deliveries (
  session_id uuid not null,
  subscription_id uuid not null references private.shopping_push_subscriptions(id) on delete cascade,
  created_at timestamptz not null,
  primary key (session_id, subscription_id)
);
create index shopping_push_due_idx on private.shopping_push_deliveries(created_at, session_id, subscription_id);
create index shopping_push_subscription_idx on private.shopping_push_deliveries(subscription_id);

alter table private.shopping_push_subscriptions enable row level security;
alter table private.shopping_push_deliveries enable row level security;
revoke all on private.shopping_push_subscriptions, private.shopping_push_deliveries from public, anon, authenticated;

create function public.register_shopping_push(p_endpoint text, p_p256dh text, p_auth text, p_expires_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := private.current_family_id();
begin
  perform 1 from public.families where id = v_family for update;
  if not exists (select 1 from public.family_members where family_id = v_family and user_id = v_user) then
    raise exception 'Sin acceso familiar' using errcode = '42501';
  end if;
  if p_expires_at is not null and p_expires_at <= statement_timestamp() then
    raise exception 'Suscripción vencida' using errcode = '22023';
  end if;
  insert into private.shopping_push_subscriptions as s (family_id, user_id, endpoint, p256dh, auth_key, expires_at)
    values (v_family, v_user, p_endpoint, p_p256dh, p_auth, p_expires_at)
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth_key = excluded.auth_key,
      expires_at = excluded.expires_at, revision = gen_random_uuid()
    where s.family_id = v_family and s.user_id = v_user;
  if not found then raise exception 'La suscripción pertenece a otra cuenta' using errcode = '23505'; end if;
end $$;

create function public.has_shopping_push(p_endpoint text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.shopping_push_subscriptions
    where user_id = auth.uid() and family_id = private.current_family_id() and endpoint = p_endpoint
      and (expires_at is null or expires_at > statement_timestamp()))
$$;

create function public.unregister_shopping_push(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from private.shopping_push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint
$$;

create function private.queue_shopping_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.shopping_push_deliveries(session_id, subscription_id, created_at)
    select new.id, s.id, new.started_at from private.shopping_push_subscriptions s
    where s.family_id = new.family_id and s.user_id <> new.started_by
      and (s.expires_at is null or s.expires_at > new.started_at)
    on conflict do nothing;
  return new;
end $$;

create trigger queue_shopping_push after insert or update of id on public.shopping_sessions
  for each row execute function private.queue_shopping_push();

-- Reclamo de una sola vez. También consume entregas que dejaron de ser válidas.
create function public.claim_shopping_push() returns table (
  session_id uuid, subscription_id uuid, revision uuid, endpoint text, p256dh text, auth_key text,
  display_name text, deliver_until timestamptz
)
language sql security definer set search_path = '' as $$
  with batch as (
    select d.session_id, d.subscription_id from private.shopping_push_deliveries d
    order by d.created_at, d.session_id, d.subscription_id limit 32 for update skip locked
  ), claimed as (
    delete from private.shopping_push_deliveries d using batch b
    where d.session_id = b.session_id and d.subscription_id = b.subscription_id
    returning d.session_id, d.subscription_id, d.created_at
  )
  select c.session_id, p.id, p.revision, p.endpoint, p.p256dh, p.auth_key, m.display_name,
    least(s.expires_at, c.created_at + interval '5 minutes', p.expires_at)
  from claimed c
  join public.shopping_sessions s on s.id = c.session_id
  join public.family_members m on m.family_id = s.family_id and m.user_id = s.started_by
  join private.shopping_push_subscriptions p on p.id = c.subscription_id and p.family_id = s.family_id
  where p.user_id <> s.started_by
    and least(s.expires_at, c.created_at + interval '5 minutes', p.expires_at) > statement_timestamp()
$$;

-- La respuesta del proveedor corresponde a la revisión que se intentó enviar.
create function public.invalidate_shopping_push(p_id uuid, p_revision uuid) returns void
language sql security definer set search_path = '' as $$
  delete from private.shopping_push_subscriptions where id = p_id and revision = p_revision
$$;

revoke all on function private.queue_shopping_push() from public, anon, authenticated;
revoke all on function public.register_shopping_push(text, text, text, timestamptz), public.has_shopping_push(text),
  public.unregister_shopping_push(text), public.claim_shopping_push(), public.invalidate_shopping_push(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.register_shopping_push(text, text, text, timestamptz), public.has_shopping_push(text),
  public.unregister_shopping_push(text) to authenticated;
grant execute on function public.claim_shopping_push(), public.invalidate_shopping_push(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
