-- MCF TICKETS v1 | Isolated project database; do not apply to HOST's existing database.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- Helpers live outside the exposed Data API schema; policies can invoke them.
grant usage on schema private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'promoter' check (role in ('admin','promoter','scanner')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  subtitle text not null default '',
  description text not null default '',
  venue text not null,
  city text not null default 'Posadas, Misiones',
  cover_url text,
  starts_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  price_cents bigint not null check (price_cents >= 0),
  capacity integer not null check (capacity >= 0),
  created_at timestamptz not null default now(),
  unique (event_id, name),
  unique (id, event_id)
);

create table public.event_staff (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_issue_paid boolean not null default false,
  courtesy_limit integer not null default 0 check (courtesy_limit >= 0),
  courtesy_used integer not null default 0 check (courtesy_used >= 0 and courtesy_used <= courtesy_limit),
  primary key (event_id, user_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  ticket_type_id uuid not null,
  buyer_name text not null,
  buyer_email text not null,
  source text not null check (source in ('online','promoter','complimentary')),
  promoter_id uuid references public.profiles(id),
  amount_cents bigint not null check (amount_cents >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','approved','reported','complimentary','rejected','refunded')),
  mp_preference_id text,
  mp_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  foreign key (ticket_type_id, event_id) references public.ticket_types(id, event_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  event_id uuid not null references public.events(id),
  ticket_type_id uuid not null references public.ticket_types(id),
  token_hash text not null unique check (char_length(token_hash) = 64),
  holder_name text not null,
  holder_email text not null,
  status text not null default 'valid' check (status in ('valid','used','void')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id)
);

create table public.ticket_audit (
  id bigint generated always as identity primary key,
  ticket_id uuid references public.tickets(id),
  event_id uuid not null references public.events(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  created_at timestamptz not null default now()
);

create index events_status_starts_idx on public.events(status, starts_at);
create index types_event_idx on public.ticket_types(event_id);
create index staff_user_idx on public.event_staff(user_id);
create index orders_event_status_idx on public.orders(event_id, payment_status, created_at desc);
create index orders_promoter_idx on public.orders(promoter_id, created_at desc) where promoter_id is not null;
create index tickets_event_status_idx on public.tickets(event_id, status);
create index tickets_type_idx on public.tickets(ticket_type_id);
create index audit_event_created_idx on public.ticket_audit(event_id, created_at desc);

create function private.is_admin(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin' and p.active);
$$;

create function private.is_event_staff(p_user_id uuid, p_event_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_staff es join public.profiles p on p.id=es.user_id
    where es.user_id=p_user_id and es.event_id=p_event_id and p.active
  );
$$;

grant execute on function private.is_admin(uuid) to anon, authenticated;
grant execute on function private.is_event_staff(uuid,uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.event_staff enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_audit enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin(auth.uid())));
create policy profiles_admin_write on public.profiles for all to authenticated
using ((select private.is_admin(auth.uid()))) with check ((select private.is_admin(auth.uid())));

create policy events_public_read on public.events for select to anon,authenticated
using (status = 'published' or (select private.is_admin(auth.uid())) or private.is_event_staff((select auth.uid()), id));
create policy events_admin_write on public.events for all to authenticated
using ((select private.is_admin(auth.uid()))) with check ((select private.is_admin(auth.uid())));

create policy types_public_read on public.ticket_types for select to anon,authenticated
using (exists (select 1 from public.events e where e.id=event_id));
create policy types_admin_write on public.ticket_types for all to authenticated
using ((select private.is_admin(auth.uid()))) with check ((select private.is_admin(auth.uid())));

create policy staff_read on public.event_staff for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin(auth.uid())));
create policy staff_admin_write on public.event_staff for all to authenticated
using ((select private.is_admin(auth.uid()))) with check ((select private.is_admin(auth.uid())));

create policy orders_staff_read on public.orders for select to authenticated
using ((select private.is_admin(auth.uid())) or (promoter_id=(select auth.uid()) and private.is_event_staff((select auth.uid()), event_id)));
create policy orders_admin_update on public.orders for update to authenticated
using ((select private.is_admin(auth.uid()))) with check ((select private.is_admin(auth.uid())));

create policy tickets_staff_read on public.tickets for select to authenticated
using ((select private.is_admin(auth.uid())) or exists (
  select 1 from public.orders o where o.id=order_id and o.promoter_id=(select auth.uid())
  and private.is_event_staff((select auth.uid()), o.event_id)
));
create policy audit_admin_read on public.ticket_audit for select to authenticated
using ((select private.is_admin(auth.uid())));

-- Public API access needs both grants and RLS. All sensitive writes use RPC/Edge Functions.
grant usage on schema public to anon, authenticated;
grant select on public.events, public.ticket_types to anon;
grant select on public.events, public.ticket_types, public.profiles, public.event_staff,
  public.orders, public.tickets, public.ticket_audit to authenticated;
grant insert, update, delete on public.events, public.ticket_types, public.event_staff, public.profiles to authenticated;
grant update on public.orders to authenticated;

create function public.issue_staff_ticket(
  p_event_id uuid, p_ticket_type_id uuid, p_holder_name text,
  p_holder_email text, p_kind text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_tier public.ticket_types%rowtype;
  v_event public.events%rowtype;
  v_staff public.event_staff%rowtype;
  v_token text;
  v_order uuid;
  v_ticket uuid;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if p_kind not in ('promoter','complimentary') then raise exception 'invalid issue type'; end if;
  if char_length(trim(p_holder_name)) not between 2 and 150 or p_holder_email !~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'
  then raise exception 'invalid holder'; end if;
  v_admin := private.is_admin(v_actor);
  select * into v_event from public.events where id=p_event_id;
  if not found or v_event.status <> 'published' then raise exception 'event unavailable'; end if;
  select * into v_tier from public.ticket_types where id=p_ticket_type_id and event_id=p_event_id for update;
  if not found then raise exception 'ticket type unavailable'; end if;
  if not v_admin then
    select * into v_staff from public.event_staff where user_id=v_actor and event_id=p_event_id for update;
    if not found or not exists (select 1 from public.profiles where id=v_actor and role='promoter' and active)
    then raise exception 'not authorized for event'; end if;
    if p_kind='promoter' and not v_staff.can_issue_paid then raise exception 'sales not allowed'; end if;
    if p_kind='complimentary' and v_staff.courtesy_used>=v_staff.courtesy_limit then raise exception 'courtesy quota reached'; end if;
  end if;
  if (select count(*) from public.tickets where ticket_type_id=p_ticket_type_id and status<>'void') >= v_tier.capacity
  then raise exception 'sold out'; end if;
  if p_kind='complimentary' and not v_admin then
    update public.event_staff set courtesy_used=courtesy_used+1 where event_id=p_event_id and user_id=v_actor;
  end if;
  insert into public.orders(event_id,ticket_type_id,buyer_name,buyer_email,source,promoter_id,amount_cents,payment_status)
  values (p_event_id,p_ticket_type_id,trim(p_holder_name),lower(trim(p_holder_email)),p_kind,
    v_actor,case when p_kind='complimentary' then 0 else v_tier.price_cents end,
    case when p_kind='complimentary' then 'complimentary' else 'reported' end)
  returning id into v_order;
  v_token := 'MCF:'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.tickets(order_id,event_id,ticket_type_id,token_hash,holder_name,holder_email)
  values (v_order,p_event_id,p_ticket_type_id,encode(sha256(convert_to(v_token,'UTF8')),'hex'),trim(p_holder_name),lower(trim(p_holder_email)))
  returning id into v_ticket;
  insert into public.ticket_audit(ticket_id,event_id,actor_id,action) values(v_ticket,p_event_id,v_actor,'issued_'||p_kind);
  return jsonb_build_object('ticket_id',v_ticket,'order_id',v_order,'token',v_token,'payment_status',case when p_kind='complimentary' then 'complimentary' else 'reported' end);
end;
$$;

create function public.redeem_ticket(p_token text,p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_ticket public.tickets%rowtype;
  v_role text;
  v_type text;
begin
  select role into v_role from public.profiles where id=v_actor and active;
  if v_actor is null or v_role is null then raise exception 'not authorized'; end if;
  if not (private.is_admin(v_actor) or
    (v_role='scanner' and private.is_event_staff(v_actor,p_event_id)))
  then raise exception 'scanner not authorized for event'; end if;
  if p_token is null or length(p_token) < 40 or length(p_token) > 128 then
    return jsonb_build_object('status','invalid');
  end if;
  select * into v_ticket from public.tickets where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found or v_ticket.status='void' then return jsonb_build_object('status','invalid'); end if;
  if v_ticket.event_id<>p_event_id then return jsonb_build_object('status','wrong_event'); end if;
  update public.tickets set status='used',checked_in_at=now(),checked_in_by=v_actor
  where id=v_ticket.id and status='valid' returning * into v_ticket;
  if not found then return jsonb_build_object('status','used'); end if;
  select name into v_type from public.ticket_types where id=v_ticket.ticket_type_id;
  insert into public.ticket_audit(ticket_id,event_id,actor_id,action)
    values(v_ticket.id,p_event_id,v_actor,'checked_in');
  return jsonb_build_object('status','valid','ticket_id',v_ticket.id,'holder',v_ticket.holder_name,'tier',v_type);
end;
$$;

revoke all on function public.issue_staff_ticket(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.redeem_ticket(text,uuid) from public,anon;
grant execute on function public.issue_staff_ticket(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.redeem_ticket(text,uuid) to authenticated;
