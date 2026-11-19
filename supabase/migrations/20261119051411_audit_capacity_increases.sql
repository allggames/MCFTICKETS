-- MCF TICKETS v3: cupos independientes por sector/lote y aumentos auditados.
-- Las ampliaciones no cambian órdenes, importes ni QR anteriores.

create table public.ticket_capacity_adjustments (
  id bigint generated always as identity primary key,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  batch_id uuid not null references public.ticket_batches(id) on delete restrict,
  previous_capacity integer not null check (previous_capacity >= 0),
  new_capacity integer not null check (new_capacity >= 0),
  delta integer not null check (delta <> 0),
  reason text not null default 'Ajuste manual de cupo',
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ticket_capacity_adjustments_arithmetic check (new_capacity - previous_capacity = delta)
);

create index ticket_capacity_adjustments_tier_created_idx
  on public.ticket_capacity_adjustments(ticket_type_id, created_at desc);
create index ticket_capacity_adjustments_event_created_idx
  on public.ticket_capacity_adjustments(event_id, created_at desc);

alter table public.ticket_capacity_adjustments enable row level security;
create policy ticket_capacity_adjustments_admin_read
  on public.ticket_capacity_adjustments for select to authenticated
  using ((select private.is_admin(auth.uid())));
grant select on public.ticket_capacity_adjustments to authenticated;

-- Toda modificación de cupo pasa por el historial, incluso si un admin edita
-- directamente ticket_types. El bloqueo de la fila del sector serializa el
-- ajuste con las emisiones manuales de ese mismo sector.
create function private.audit_ticket_type_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_issued bigint;
  v_reason text;
begin
  select count(*) into v_issued from public.tickets t
  where t.ticket_type_id = new.id and t.status <> 'void';

  if new.capacity < v_issued then
    raise exception 'capacity cannot be below % already issued tickets', v_issued;
  end if;

  v_reason := nullif(trim(current_setting('mcf.capacity_change_reason', true)), '');
  insert into public.ticket_capacity_adjustments (
    ticket_type_id, event_id, batch_id, previous_capacity,
    new_capacity, delta, reason, actor_id
  ) values (
    new.id, new.event_id, new.batch_id, old.capacity,
    new.capacity, new.capacity - old.capacity,
    left(coalesce(v_reason, 'Ajuste manual de cupo'), 180), auth.uid()
  );

  return new;
end;
$$;

revoke all on function private.audit_ticket_type_capacity() from public, anon, authenticated;

create trigger ticket_types_capacity_audit
after update of capacity on public.ticket_types
for each row when (old.capacity is distinct from new.capacity)
execute function private.audit_ticket_type_capacity();

-- RPC segura para sumar cupo durante el evento. No permite descuentos de cupo,
-- alteración de otros sectores ni modificación de entradas ya emitidas.
create function public.increase_ticket_capacity(
  p_ticket_type_id uuid, p_additional integer, p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_new_capacity integer;
begin
  if v_actor is null or not private.is_admin(v_actor) then
    raise exception 'administrator role required';
  end if;
  if p_additional is null or p_additional <= 0 or p_additional > 1000000 then
    raise exception 'additional capacity must be between 1 and 1000000';
  end if;
  perform set_config('mcf.capacity_change_reason', left(coalesce(trim(p_reason), ''), 180), true);

  update public.ticket_types
  set capacity = capacity + p_additional
  where id = p_ticket_type_id
  returning capacity into v_new_capacity;

  if not found then raise exception 'ticket sector not found'; end if;

  return jsonb_build_object('ticket_type_id', p_ticket_type_id,
    'added', p_additional, 'new_capacity', v_new_capacity);
end;
$$;

revoke all on function public.increase_ticket_capacity(uuid, integer, text) from public, anon;
grant execute on function public.increase_ticket_capacity(uuid, integer, text) to authenticated;
