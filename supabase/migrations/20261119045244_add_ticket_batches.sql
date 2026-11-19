-- MCF TICKETS v2: lotes por evento, sectores y precios por lote.
create table public.ticket_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, name),
  unique (id, event_id)
);

-- Un solo lote disponible para ventas por evento.
create unique index ticket_batches_one_active_idx on public.ticket_batches(event_id)
  where status = 'active';
create index ticket_batches_event_order_idx on public.ticket_batches(event_id, sort_order);

-- Migración segura incluso si ya hubiese eventos y sectores existentes.
insert into public.ticket_batches (event_id, name, status)
select id, 'Lote 1', 'active' from public.events;

alter table public.ticket_types add column batch_id uuid;
update public.ticket_types tt set batch_id = b.id
from public.ticket_batches b where b.event_id = tt.event_id;
alter table public.ticket_types alter column batch_id set not null;
alter table public.ticket_types
  add constraint ticket_types_batch_event_fkey foreign key (batch_id, event_id)
  references public.ticket_batches(id, event_id) on delete restrict;
alter table public.ticket_types drop constraint ticket_types_event_id_name_key;
alter table public.ticket_types add constraint ticket_types_batch_name_key unique (batch_id, name);
create index ticket_types_batch_id_idx on public.ticket_types(batch_id);

-- Los lotes en espera o cerrados quedan ocultos para compradores anónimos.
alter table public.ticket_batches enable row level security;
create policy batches_read on public.ticket_batches for select to anon, authenticated
using (
  (status = 'active' and exists (
    select 1 from public.events e where e.id = event_id and e.status = 'published'
  )) or (select private.is_admin(auth.uid())) or
  private.is_event_staff((select auth.uid()), event_id)
);
create policy batches_admin_write on public.ticket_batches for all to authenticated
using ((select private.is_admin(auth.uid())))
with check ((select private.is_admin(auth.uid())));

grant select on public.ticket_batches to anon, authenticated;
grant insert, update, delete on public.ticket_batches to authenticated;

drop policy types_public_read on public.ticket_types;
create policy types_public_read on public.ticket_types for select to anon, authenticated
using (
  exists (
    select 1 from public.ticket_batches b join public.events e on e.id = b.event_id
    where b.id = batch_id and b.status = 'active' and e.status = 'published'
  ) or (select private.is_admin(auth.uid())) or
  private.is_event_staff((select auth.uid()), event_id)
);

-- Impide nuevas órdenes sobre lotes no activos (sin afectar órdenes previas).
create function private.require_active_batch_on_order()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.ticket_types tt
    join public.ticket_batches b on b.id = tt.batch_id and b.event_id = tt.event_id
    where tt.id = new.ticket_type_id and tt.event_id = new.event_id and b.status = 'active'
  ) then
    raise exception 'ticket batch is not active';
  end if;
  return new;
end;
$$;

revoke all on function private.require_active_batch_on_order() from public, anon, authenticated;
create trigger orders_require_active_batch
before insert on public.orders for each row
execute function private.require_active_batch_on_order();
