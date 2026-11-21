import { useState } from 'react';
import { Check, CircleAlert, Eye, LockKeyhole, Plus, Settings2, ShieldCheck, UserCheck, UsersRound, X } from 'lucide-react';
import { dateLabel, makeId, type EventItem, type StaffMember, type StaffRole } from './data';

export type WorkspacePage = 'admin' | 'eventos' | 'publicos' | 'scanner' | 'permisos';

export function canAccessPage(user: StaffMember | null, page: WorkspacePage): boolean {
  if (!user) return page === 'eventos';
  if (!user.active) return false;
  if (user.role === 'admin') return true;
  return page === 'publicos';
}

export const staffRoleLabel = (role: StaffRole): string =>
  role === 'admin' ? 'Administrador' : 'RR. PP.';

export function canSellEvent(user: StaffMember | null, eventId: string): boolean {
  return Boolean(user?.active && (user.role === 'admin' || user.allowedEventIds.includes(eventId)));
}

export function canIssueInvitation(user: StaffMember | null, eventId: string): boolean {
  return Boolean(canSellEvent(user, eventId) &&
    (user?.role === 'admin' || user?.invitationEventIds.includes(eventId)));
}

export function PermissionsPage({ staff, events, onChange, onPreview }: {
  staff: StaffMember[];
  events: EventItem[];
  onChange: (next: StaffMember[]) => void;
  onPreview: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('promoter');
  const [error, setError] = useState('');
  const [pendingAdminId, setPendingAdminId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? '');
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [bulkAction, setBulkAction] = useState<'enable' | 'disable' | null>(null);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  const visible = staff.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase()));
  const selectedEvent = events.find(event => event.id === selectedEventId) ?? events[0];
  const promoters = staff.filter(member => member.role === 'promoter');
  const filteredPromoters = visible.filter(member => member.role === 'promoter');
  const enabledCount = selectedEvent ? promoters.filter(member => member.active && member.allowedEventIds.includes(selectedEvent.id)).length : 0;
  const activeAdmins = staff.filter(member => member.role === 'admin' && member.active);
  const detailMember = staff.find(member => member.id === detailMemberId);

  function update(id: string, edit: (member: StaffMember) => StaffMember) {
    onChange(staff.map(member => member.id === id ? edit(member) : member));
  }

  function changeRole(member: StaffMember, next: StaffRole) {
    if (next === member.role) return;
    if (member.role === 'admin' && member.active && activeAdmins.length === 1) {
      setError('Debe quedar al menos un administrador activo.'); return;
    }
    if (next === 'admin') { setPendingAdminId(member.id); return; }
    update(member.id, row => ({ ...row, role: next, allowedEventIds: [], invitationEventIds: [] }));
    setError('');
  }

  function addMember(e: React.FormEvent) {
    e.preventDefault();
    const displayName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (displayName.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      setError('Ingresá un nombre y un correo válidos.'); return;
    }
    if (staff.some(member => member.email.toLowerCase() === normalizedEmail)) {
      setError('Ese correo ya figura en la lista de usuarios.'); return;
    }
    onChange([...staff, { id: makeId(), name: displayName, email: normalizedEmail,
      role, active: false, allowedEventIds: [], invitationEventIds: [] }]);
    setName(''); setEmail(''); setRole('promoter'); setShowNew(false); setError('');
  }

  function toggleMemberEvent(member: StaffMember, eventId: string) {
    if (member.role !== 'promoter' || !events.some(event => event.id === eventId)) return;
    update(member.id, row => row.allowedEventIds.includes(eventId)
      ? { ...row, allowedEventIds: row.allowedEventIds.filter(id => id !== eventId),
        invitationEventIds: row.invitationEventIds.filter(id => id !== eventId) }
      : { ...row, allowedEventIds: [...row.allowedEventIds, eventId] });
  }

  function toggleMemberInvitation(member: StaffMember, eventId: string) {
    if (member.role !== 'promoter' || !member.allowedEventIds.includes(eventId) || !events.some(event => event.id === eventId)) return;
    update(member.id, row => ({ ...row, invitationEventIds: row.invitationEventIds.includes(eventId)
      ? row.invitationEventIds.filter(id => id !== eventId) : [...row.invitationEventIds, eventId] }));
  }

  function applyBulk() {
    if (!selectedEvent || !bulkAction) return;
    const ids = new Set(filteredPromoters.map(member => member.id));
    onChange(staff.map(member => {
      if (!ids.has(member.id)) return member;
      return { ...member, allowedEventIds: bulkAction === 'enable'
        ? Array.from(new Set([...member.allowedEventIds, selectedEvent.id]))
        : member.allowedEventIds.filter(id => id !== selectedEvent.id),
        invitationEventIds: bulkAction === 'disable'
          ? member.invitationEventIds.filter(id => id !== selectedEvent.id) : member.invitationEventIds };
    }));
    setBulkAction(null);
  }

  function toggleActive(member: StaffMember) {
    if (member.role === 'admin' && member.active && activeAdmins.length === 1) {
      setError('No podés desactivar al único administrador activo.'); return;
    }
    update(member.id, row => ({ ...row, active: !row.active }));
    setError('');
  }

  return <section className="page-content permissions-page">
    <div className="page-heading"><div><div className="section-eyebrow">ADMINISTRACIÓN · USUARIOS Y PERMISOS <span className="eyebrow-line"/></div>
      <h1>Panel de <span>administración.</span></h1>
      <p>Creá, activá o desactivá usuarios; asigná roles y permisos de venta e invitaciones por evento.</p></div>
      <button className="btn btn-primary" onClick={() => { setShowNew(true); setError(''); }}><Plus size={17}/> Crear usuario</button>
    </div>

    <div className="permissions-warning"><CircleAlert size={19}/><div><strong>Esta pantalla sigue siendo una demostración.</strong>
      <p>Las asignaciones se guardan solo en este navegador. Todavía faltan Supabase Auth y la verificación de permisos en el servidor. No uses datos de eventos reales.</p>
    </div></div>

    <div className="permission-guide permission-guide-two">
      <div className="permission-guide-item"><ShieldCheck size={22}/><strong>Administrador</strong><span>Controla los eventos y puede generar invitaciones sin cargo para todos ellos.</span></div>
      <div className="permission-guide-item"><UsersRound size={22}/><strong>RR. PP.</strong><span>Puede vender entradas de sus eventos asignados. Las invitaciones están bloqueadas por defecto y se autorizan por separado.</span></div>
    </div>

    <section className="panel permissions-panel"><div className="panel-title"><div><h2>Usuarios registrados</h2>
      <p>Elegí una persona y entrá en Configurar para darle acceso a sus eventos.</p></div>
      <div className="permission-users-tools"><input className="permission-search" aria-label="Buscar persona" placeholder="Buscar persona o correo" value={search} onChange={e => setSearch(e.target.value)}/>
        <button type="button" className="adm-open-qr" disabled={!events.length || !filteredPromoters.length} onClick={() => setShowBulkManager(true)}><UsersRound size={15}/> Habilitación masiva</button></div></div>
      {error && <div className="form-error permission-error"><CircleAlert size={16}/>{error}</div>}
      <div className="permission-user-grid">
        {visible.map(member => {
          const salesCount = member.role === 'admin' ? events.length : events.filter(event => member.allowedEventIds.includes(event.id)).length;
          const invitationsCount = member.role === 'admin' ? events.length : events.filter(event => member.allowedEventIds.includes(event.id) && member.invitationEventIds.includes(event.id)).length;
          const initials = member.name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
          return <article className={`permission-user-card ${member.role === 'admin' ? 'permission-user-admin' : ''}`} key={member.id}>
            <div className="permission-user-identity">
              <div className="permission-user-avatar" aria-hidden="true">{initials}</div>
              <div className="permission-user-name"><strong>{member.name}</strong><span title={member.email}>{member.email}</span></div>
              <span className="permission-user-tag">{member.role === 'admin' ? 'ADMIN' : 'RR. PP.'}</span>
            </div>
            <div className="permission-user-settings">
              <label className="permission-user-field"><span>ROL</span><select className="permission-role" aria-label={`Rol de ${member.name}`} value={member.role} onChange={e => changeRole(member, e.target.value as StaffRole)}>
                <option value="admin">Administrador</option><option value="promoter">RR. PP.</option></select></label>
              <div className="permission-user-field"><span>ESTADO</span><button type="button" className={`permission-status ${member.active ? 'permission-active' : 'permission-pending'}`}
                aria-label={`${member.active ? 'Desactivar' : 'Activar'} a ${member.name}`} onClick={() => toggleActive(member)}>
                {member.active ? <><Check size={14}/> Activo</> : <><X size={14}/> Bloqueado</>}</button></div>
            </div>
            <div className="permission-user-event-title"><span>ACCESOS POR EVENTO</span>
              <small>{member.role === 'admin' ? 'Acceso completo a todos los eventos' : 'Administralos desde Configurar'}</small></div>
            <div className="permission-user-choices">
              <div className="permission-user-total"><strong>{salesCount}</strong><span>Eventos con venta</span></div>
              <div className="permission-user-total"><strong>{invitationsCount}</strong><span>Eventos con invitaciones</span></div>
            </div>
            <div className="permission-user-actions">
              <button type="button" className="adm-open-qr" onClick={() => setDetailMemberId(member.id)} aria-label={`Gestionar eventos de ${member.name}`}><Settings2 size={15}/> Configurar</button>
              <button type="button" className="adm-open-qr" disabled={!member.active} onClick={() => onPreview(member.id)}><Eye size={15}/> Probar acceso</button>
            </div>
          </article>;
        })}
        {!visible.length && <p className="adm-empty permission-user-empty">No encontramos personas con esa búsqueda.</p>}
      </div>
      <div className="adm-data-note"><LockKeyhole size={16}/><span>Las invitaciones son QR de cortesía sin cobro. Por defecto solo las emite el administrador. Podés autorizar a un RR. PP. para un evento puntual; si le quitás ese evento, pierde también el permiso de invitaciones. El lector QR se configurará más adelante.</span></div>
    </section>

    {showBulkManager && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setShowBulkManager(false); }}>
      <div className="modal-card permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-bulk-manager-title">
        <div className="modal-header"><div><h2 id="permission-bulk-manager-title">Habilitación masiva</h2>
          <p>Asigná o quitá el permiso de venta a varios RR. PP. en un solo evento.</p></div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setShowBulkManager(false)}><X size={19}/></button></div>
        <label className="permission-bulk-select">EVENTO
          <select value={selectedEvent?.id ?? ''} onChange={e => setSelectedEventId(e.target.value)} disabled={!events.length}>
            {events.map(event => <option key={event.id} value={event.id}>{event.title} · {dateLabel(event.date)}</option>)}
          </select>
        </label>
        <div className="permission-bulk-stats"><span><strong>{filteredPromoters.length}</strong> RR. PP. seleccionados por búsqueda</span>
          <span><strong>{enabledCount}</strong> RR. PP. activos habilitados actualmente</span></div>
        <p className="adm-helper">Solo se modifican los RR. PP. que aparecen en la búsqueda de Usuarios registrados. Los administradores nunca se incluyen.</p>
        <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowBulkManager(false)}>Cancelar</button>
          <button type="button" className="btn btn-secondary" disabled={!selectedEvent || !filteredPromoters.length} onClick={() => { setShowBulkManager(false); setBulkAction('disable'); }}><X size={15}/> Deshabilitar</button>
          <button type="button" className="btn btn-primary" disabled={!selectedEvent || !filteredPromoters.length} onClick={() => { setShowBulkManager(false); setBulkAction('enable'); }}><Check size={15}/> Habilitar</button></div>
      </div>
    </div>}

    {detailMember && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setDetailMemberId(null); }}>
      <div className="modal-card permission-modal permission-detail-modal" role="dialog" aria-modal="true" aria-labelledby="permission-detail-title">
        <div className="modal-header"><div><h2 id="permission-detail-title">Permisos de {detailMember.name}</h2>
          <p>{detailMember.email} · {staffRoleLabel(detailMember.role)} · {detailMember.active ? 'Usuario activo' : 'Usuario desactivado'}</p></div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setDetailMemberId(null)}><X size={19}/></button></div>
        <div className="permission-detail-summary"><span><strong>{detailMember.role === 'admin' ? events.length : detailMember.allowedEventIds.filter(id => events.some(event => event.id === id)).length}</strong> eventos con venta</span>
          <span><strong>{detailMember.role === 'admin' ? events.length : detailMember.invitationEventIds.filter(id => events.some(event => event.id === id) && detailMember.allowedEventIds.includes(id)).length}</strong> eventos con invitaciones</span></div>
        <p className="permission-detail-intro">Cada rectángulo representa un evento. Activá la venta y, si corresponde, el permiso para enviar invitaciones. Los cambios se guardan automáticamente en esta demostración.</p>
        <div className="permission-detail-list">
          {events.map(event => {
            const canSell = detailMember.role === 'admin' || detailMember.allowedEventIds.includes(event.id);
            const canInvite = detailMember.role === 'admin' || (canSell && detailMember.invitationEventIds.includes(event.id));
            return <div className={`permission-detail-event ${canSell ? 'permission-detail-event-enabled' : ''}`} key={event.id}>
              <div className="permission-detail-event-top">
                <span className="permission-detail-event-kicker">EVENTO</span>
                <span className={`permission-detail-event-status ${canSell ? 'permission-detail-event-status-on' : ''}`}>
                  {canInvite ? 'Venta + invitaciones' : canSell ? 'Venta habilitada' : 'Sin acceso'}
                </span>
              </div>
              <div className="permission-detail-event-name"><strong>{event.title}</strong><span>{dateLabel(event.date)}</span></div>
              <div className="permission-detail-options">
                <label className={`permission-detail-option ${canSell ? 'permission-detail-option-on' : ''}`}>
                  <span className="permission-detail-option-heading">Venta de entradas</span>
                  <span className="permission-detail-option-control"><input type="checkbox" aria-label={`Permitir ventas a ${detailMember.name} en ${event.title}`}
                    checked={canSell} disabled={detailMember.role === 'admin'} onChange={() => toggleMemberEvent(detailMember, event.id)}/><span>{canSell ? 'Habilitada' : 'Deshabilitada'}</span></span>
                </label>
                <label className={`permission-detail-option ${canInvite ? 'permission-detail-option-on' : ''} ${!canSell ? 'permission-detail-option-disabled' : ''}`}>
                  <span className="permission-detail-option-heading">Invitaciones</span>
                  <span className="permission-detail-option-control"><input type="checkbox" aria-label={`Permitir invitaciones a ${detailMember.name} en ${event.title}`}
                    checked={canInvite} disabled={detailMember.role === 'admin' || !canSell} onChange={() => toggleMemberInvitation(detailMember, event.id)}/><span>{canInvite ? 'Permitidas' : 'Bloqueadas'}</span></span>
                </label>
              </div>
            </div>;
          })}
          {!events.length && <p className="adm-empty">Todavía no hay eventos creados en esta demostración.</p>}
        </div>
        <div className="adm-data-note permission-detail-note"><LockKeyhole size={16}/><span>{detailMember.role === 'admin'
          ? 'El administrador tiene acceso completo a todos los eventos, ventas e invitaciones.'
          : 'Si deshabilitás la venta de un evento, también se retiran sus invitaciones. Podés preparar permisos aunque el usuario esté desactivado: no podrá entrar hasta que lo actives.'}</span></div>
        <div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={() => setDetailMemberId(null)}>Listo, cerrar</button></div>
      </div>
    </div>}

    {showNew && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setShowNew(false); }}><form className="modal-card permission-modal" onSubmit={addMember}>
      <div className="modal-header"><div><h2>Agregar persona</h2><p>Prepará los permisos del nuevo integrante del equipo.</p></div>
        <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setShowNew(false)}><X size={19}/></button></div>
      <div className="form-stack"><label>Nombre y apellido<input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del colaborador"/></label>
        <label>Correo electrónico<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
        <label>Rol inicial<select value={role} onChange={e => setRole(e.target.value as StaffRole)}>
          <option value="promoter">RR. PP. — Eventos asignados</option>
          <option value="admin">Administrador — Todas las áreas</option></select></label></div>
      <p className="adm-helper">Quedará pendiente y sin eventos habilitados hasta que lo apruebes. Esto no envía una invitación real ni crea una cuenta de Supabase.</p>
      {error && <div className="form-error"><CircleAlert size={15}/>{error}</div>}
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancelar</button>
        <button type="submit" className="btn btn-primary"><UserCheck size={17}/> Agregar pendiente</button></div>
    </form></div>}

    {pendingAdminId && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setPendingAdminId(null); }}>
      <div className="modal-card permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-promote-title">
        <div className="modal-header"><div><h2 id="permission-promote-title">¿Dar acceso completo?</h2><p>Permisos de administrador</p></div>
          <button className="icon-button" aria-label="Cerrar" onClick={() => setPendingAdminId(null)}><X size={19}/></button></div>
        <p className="permission-confirm-text">Este rol permite crear eventos, consultar todos los QR y modificar permisos de otras personas. En producción requerirá autenticación y autorización verificadas en Supabase.</p>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setPendingAdminId(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { update(pendingAdminId, member => ({ ...member, role: 'admin', allowedEventIds: [], invitationEventIds: [] })); setPendingAdminId(null); }}>
            Sí, dar acceso total</button></div>
      </div>
    </div>}
    {bulkAction && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setBulkAction(null); }}>
      <div className="modal-card permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-bulk-title">
        <div className="modal-header"><div><h2 id="permission-bulk-title">¿{bulkAction === 'enable' ? 'Habilitar' : 'Deshabilitar'} {filteredPromoters.length} RR. PP.?</h2>
          <p>{selectedEvent?.title}</p></div><button className="icon-button" aria-label="Cerrar" onClick={() => setBulkAction(null)}><X size={19}/></button></div>
        <p className="permission-confirm-text">Se {bulkAction === 'enable' ? 'agregará' : 'retirará'} el acceso de venta a esta fiesta para todos los RR. PP. filtrados. Al deshabilitar la venta, también se retirará el permiso de invitaciones de esa fiesta. No se afectarán otros eventos.</p>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setBulkAction(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={applyBulk}>Confirmar cambios</button></div>
      </div>
    </div>}
  </section>;
}
