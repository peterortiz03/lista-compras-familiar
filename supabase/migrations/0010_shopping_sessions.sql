begin;

create table public.shopping_sessions (
  family_id uuid primary key,
  id uuid not null unique default gen_random_uuid(),
  started_by uuid not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  foreign key (family_id, started_by) references public.family_members(family_id, user_id) on delete cascade,
  check (expires_at > started_at and expires_at <= started_at + interval '90 minutes')
);

alter table public.shopping_sessions enable row level security;
revoke all on public.shopping_sessions from public, anon, authenticated;
grant select on public.shopping_sessions to authenticated;
create policy shopping_sessions_read on public.shopping_sessions for select to authenticated
  using (family_id = (select private.current_family_id()) and expires_at > statement_timestamp());

create function public.start_shopping_session() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := private.current_family_id();
  v_started_at timestamptz;
begin
  -- El mismo bloqueo que administra las altas y bajas de integrantes.
  perform 1 from public.families where id = v_family for update;
  if not exists (select 1 from public.family_members where family_id = v_family and user_id = v_user) then
    raise exception 'Sin acceso familiar' using errcode = '42501';
  end if;
  v_started_at := clock_timestamp();
  insert into public.shopping_sessions as s (family_id, started_by, started_at, expires_at)
    values (v_family, v_user, v_started_at, v_started_at + interval '90 minutes')
    on conflict (family_id) do update set id = excluded.id, started_by = excluded.started_by,
      started_at = excluded.started_at, expires_at = excluded.expires_at
    where s.expires_at <= v_started_at;
  return found;
end $$;

create function public.end_shopping_session(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_family uuid := private.current_family_id();
  v_owner uuid;
  v_initiator uuid;
begin
  select owner_id into v_owner from public.families where id = v_family for update;
  if not exists (select 1 from public.family_members where family_id = v_family and user_id = v_user) then
    raise exception 'Sin acceso familiar' using errcode = '42501';
  end if;
  select started_by into v_initiator from public.shopping_sessions
    where family_id = v_family and id = p_session_id and expires_at > clock_timestamp();
  if not found then return false; end if;
  if v_user <> v_owner and v_user <> v_initiator then
    raise exception 'No podés finalizar este aviso' using errcode = '42501';
  end if;
  delete from public.shopping_sessions where family_id = v_family and id = p_session_id;
  return found;
end $$;

create or replace function public.get_family_list(p_stats_revision uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.get_family_list_v8(p_stats_revision) || jsonb_build_object('featuresVersion', 10,
    'shoppingSession', (select jsonb_build_object('id', s.id, 'startedBy', s.started_by,
        'displayName', m.display_name, 'expiresAt', s.expires_at)
      from public.shopping_sessions s join public.family_members m
        on m.family_id = s.family_id and m.user_id = s.started_by
      where s.family_id = private.current_family_id() and s.expires_at > statement_timestamp()))
$$;

revoke all on function public.start_shopping_session(), public.end_shopping_session(uuid) from public, anon, authenticated;
grant execute on function public.start_shopping_session(), public.end_shopping_session(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
