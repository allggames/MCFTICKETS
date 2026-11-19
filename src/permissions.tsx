import { useState } from 'react';
import { Check, CircleAlert, Eye, LockKeyhole, Plus, ShieldCheck, UserCheck, UsersRound, X } from 'lucide-react';
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
  const [bulkAction, setBulkAction] = useState<'enable' | 'disable' | null>(null);

  const visible = staff.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase()));
  const selectedEvent = events.find(event => event.id === selectedEventId) ?? events[0];
  const promoters = staff.filter(member => member.role === 'promoter');
  const filteredPromoters = visible.filter(member => member.role === 'promoter');
  const enabledCount = selectedEvent ? promoters.filter(member => member.active && member.allowedEventIds.includes(selectedEvent.id)).length : 0;
  const activeAdmins = staff.filter(member => member.role === 'admin' && member.active);

  function update(id: string, edit: (member: StaffMember) => StaffMember) {
    onChange(staff.map(member => member.id === id ? edit(member) : member));
  }

  function changeRole(member: StaffMember, next: StaffRole) {
    if (next === member.role) return;
    if (member.role === 'admin' && member.active && activeAdmins.length === 1) {
      setError('Debe quedar al menos un administrador activo.'); return;
    }
    if (next === 'admin') { setPendingAdminId(member.id); return; }
    update(member.id, row => ({ ...row, role: next, allowedEventIds: [] }));
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
      role, active: false, allowedEventIds: [] }]);
    setName(''); setEmail(''); setRole('promoter'); setShowNew(false); setError('');
  }

  function toggleEvent(member: StaffMember) {
    if (!selectedEvent || member.role !== 'promoter') return;
    update(member.id, row => ({ ...row, allowedEventIds: row.allowedEventIds.includes(selectedEvent.id)
      ? row.allowedEventIds.filter(id => id !== selectedEvent.id) : [...row.allowedEventIds, selectedEvent.id] }));
  }

  function applyBulk() {
    if (!selectedEvent || !bulkAction) return;
    const ids = new Set(filteredPromoters.map(member => member.id));
    onChange(staff.map(member => {
      if (!ids.has(member.id)) return member;
      return { ...member, allowedEventIds: bulkAction === 'enable'
        ? Array.from(new Set([...member.allowedEventIds, selectedEvent.id]))
        : member.allowedEventIds.filter(id => id !== selectedEvent.id) };
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
    <div className="page-heading"><div><div className="section-eyebrow">EQUIPO Y EVENTOS <span className="eyebrow-line"/></div>
      <h1>Usuarios y <span>permisos.</span></h1>
      <p>Elegí qué RR. PP. puede vender entradas de cada evento. Los administradores tienen acceso total.</p></div>
      <button className="btn btn-primary" onClick={() => { setShowNew(true); setError(''); }}><Plus size={17}/> Agregar persona</button>
    </div>

    <div className="permissions-warning"><CircleAlert size={19}/><div><strong>Esta pantalla sigue siendo una demostración.</strong>
      <p>Las asignaciones se guardan solo en este navegador. Todavía faltan Supabase Auth y la verificación de permisos en el servidor. No uses datos de eventos reales.</p>
    </div></div>

    <div className="permission-guide permission-guide-two">
      <div className="permission-guide-item"><ShieldCheck size={22}/><strong>Administrador</strong><span>Controla todos los eventos, usuarios, lotes, ventas y QR.</span></div>
      <div className="permission-guide-item"><UsersRound size={22}/><strong>RR. PP.</strong><span>Entra solo al panel de públicos. Puede emitir entradas exclusivamente en los eventos habilitados por el administrador.</span></div>
    </div>

    <section className="panel permissions-event-panel">
      <div className="panel-title"><div><h2>Asignaciones por evento</h2><p>Seleccioná una fiesta para controlar quiénes venden sus entradas.</p></div>
        <span className="tiny-pill">{promoters.length} RR. PP. registrados</span></div>
      <div className="permissions-event-controls"><label>EVENTO
        <select aria-label="Evento para gestionar públicos" value={selectedEvent?.id ?? ''} onChange={e => setSelectedEventId(e.target.value)} disabled={!events.length}>
          {events.map(event => <option key={event.id} value={event.id}>{event.title} · {dateLabel(event.date)}</option>)}
        </select></label>
        <div className="permission-event-stat"><strong>{enabledCount} / {promoters.length}</strong><span>RR. PP. activos habilitados</span></div>
        <div className="permission-event-stat"><strong>{selectedEvent ? promoters.filter(member => member.allowedEventIds.includes(selectedEvent.id)).length : 0}</strong><span>Asignaciones configuradas</span></div>
      </div>
      <div className="permission-event-actions"><span>Podés habilitar 10 públicos para una fiesta y 50 para otra. La búsqueda también filtra las acciones en grupo.</span>
        <div><button className="btn btn-secondary" disabled={!selectedEvent || !filteredPromoters.length} onClick={() => setBulkAction('disable')}><X size={15}/> Deshabilitar filtrados</button>
          <button className="btn btn-primary" disabled={!selectedEvent || !filteredPromoters.length} onClick={() => setBulkAction('enable')}><Check size={15}/> Habilitar filtrados</button></div></div>
    </section>

    <section className="panel permissions-panel"><div className="panel-title"><div><h2>Usuarios registrados</h2>
      <p>Autorizá cada RR. PP. para el evento elegido o suspendé su cuenta completa.</p></div>
      <input className="permission-search" aria-label="Buscar persona" placeholder="Buscar persona o correo" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {error && <div className="form-error permission-error"><CircleAlert size={16}/>{error}</div>}
      <div className="permissions-table-scroll"><table className="data-table permissions-table"><thead><tr>
        <th>PERSONA</th><th>ROL</th><th>VENTA · {selectedEvent?.title ?? 'EVENTO'}</th><th>OTROS EVENTOS</th><th>USUARIO</th><th>VISTA PREVIA</th>
      </tr></thead><tbody>{visible.map(member => <tr key={member.id}>
        <td><strong>{member.name}</strong><small className="table-secondary">{member.email}</small>{member.role === 'admin' && <small className="permission-full-access">Acceso completo</small>}</td>
        <td><select className="permission-role" aria-label={`Rol de ${member.name}`} value={member.role} onChange={e => changeRole(member, e.target.value as StaffRole)}>
          <option value="admin">Administrador</option><option value="promoter">RR. PP.</option></select></td>
        <td><label className="permission-check"><input type="checkbox" aria-label={`Autorizar a ${member.name} a vender en ${selectedEvent?.title ?? 'evento'}`}
          checked={member.role === 'admin' || Boolean(selectedEvent && member.allowedEventIds.includes(selectedEvent.id))}
          disabled={member.role === 'admin' || !selectedEvent} onChange={() => toggleEvent(member)}/>
          <span>{member.role === 'admin' ? 'Siempre' : selectedEvent && member.allowedEventIds.includes(selectedEvent.id) ? 'Habilitado' : 'Sin acceso'}</span></label></td>
        <td><span className="permission-event-count">{member.role === 'admin' ? 'Todos' : `${member.allowedEventIds.filter(id => id !== selectedEvent?.id && events.some(event => event.id === id)).length} adicionales`}</span></td>
        <td><button className={`permission-status ${member.active ? 'permission-active' : 'permission-pending'}`} onClick={() => toggleActive(member)}>
          {member.active ? <><Check size={14}/> Activo</> : <><X size={14}/> Pendiente / bloqueado</>}</button></td>
        <td><button className="adm-open-qr" disabled={!member.active} onClick={() => onPreview(member.id)}><Eye size={15}/> Probar acceso</button></td>
      </tr>)}
      {!visible.length && <tr><td colSpan={6} className="adm-empty">No encontramos personas con esa búsqueda.</td></tr>}
      </tbody></table></div>
      <div className="adm-data-note"><LockKeyhole size={16}/><span>Desmarcar un evento retira el acceso a esa fiesta, sin afectar las demás. Suspender una cuenta impide todos los accesos. El lector QR se configurará más adelante.</span></div>
    </section>

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
          <button className="btn btn-primary" onClick={() => { update(pendingAdminId, member => ({ ...member, role: 'admin', allowedEventIds: [] })); setPendingAdminId(null); }}>
            Sí, dar acceso total</button></div>
      </div>
    </div>}
    {bulkAction && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setBulkAction(null); }}>
      <div className="modal-card permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-bulk-title">
        <div className="modal-header"><div><h2 id="permission-bulk-title">¿{bulkAction === 'enable' ? 'Habilitar' : 'Deshabilitar'} {filteredPromoters.length} RR. PP.?</h2>
          <p>{selectedEvent?.title}</p></div><button className="icon-button" aria-label="Cerrar" onClick={() => setBulkAction(null)}><X size={19}/></button></div>
        <p className="permission-confirm-text">Se {bulkAction === 'enable' ? 'agregará' : 'retirará'} el acceso a esta fiesta para todos los RR. PP. de la lista filtrada. Los permisos de otros eventos y el estado general de sus cuentas no cambiarán.</p>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setBulkAction(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={applyBulk}>Confirmar cambios</button></div>
      </div>
    </div>}
  </section>;
}
