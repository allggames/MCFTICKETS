-- MCF TICKETS v4: el administrador abre/cierra los lotes manualmente.
-- El índice ticket_batches_one_active_idx (v2) impide dos lotes activos
-- por evento, y las políticas RLS de ticket_batches restringen cambios
-- de estado a los administradores. No hay transiciones automáticas.

create table public.ticket_batch_status_audit (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.ticket_batches(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  previous_status text not null check (previous_status in ('draft', 'active', 'closed')),
  next_status text not null check (next_status in ('draft', 'active', 'closed')),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ticket_batch_status_changed check (previous_status <> next_status)
);

create index ticket_batch_status_audit_batch_date_idx
  on public.ticket_batch_status_audit(batch_id, created_at desc);
create index ticket_batch_status_audit_event_date_idx
  on public.ticket_batch_status_audit(event_id, created_at desc);

alter table public.ticket_batch_status_audit enable row level security;
create policy batch_status_audit_admin_read on public.ticket_batch_status_audit
  for select to authenticated
  using ((select private.is_admin((select auth.uid()))));
grant select on public.ticket_batch_status_audit to authenticated;

-- El historial se crea del lado del servidor en la misma transacción
-- que el cambio de lote, incluso si un cliente evita la interfaz.
create function private.record_batch_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ticket_batch_status_audit
    (batch_id, event_id, previous_status, next_status, actor_id)
  values (new.id, new.event_id, old.status, new.status, auth.uid());
  return new;
end;
$$;

revoke all on function private.record_batch_status_change() from public, anon, authenticated;
create trigger ticket_batches_status_audit
after update of status on public.ticket_batches
for each row when (old.status is distinct from new.status)
execute function private.record_batch_status_change();
