import { useState } from 'react';
import { Check, CircleAlert, Eye, LockKeyhole, Plus, ShieldCheck, UserCheck, UsersRound, X } from 'lucide-react';
import { makeId, type StaffMember, type StaffRole, type StaffSection } from './data';

export type WorkspacePage = 'admin' | 'eventos' | 'publicos' | 'scanner' | 'permisos';

export function canAccessPage(user: StaffMember | null, page: WorkspacePage): boolean {
  if (!user) return page === 'eventos';
  if (!user.active) return false;
  if (user.role === 'admin') return true;
  if (page === 'publicos' || page === 'scanner') return user.sections.includes(page);
  return false;
}

export const staffRoleLabel = (role: StaffRole): string =>
  role === 'admin' ? 'Administrador' : role === 'promoter' ? 'RR. PP.' : 'Personal de puerta';

const roleDefaults = (role: StaffRole): StaffSection[] =>
  role === 'promoter' ? ['publicos'] : role === 'scanner' ? ['scanner'] : ['publicos', 'scanner'];

export function PermissionsPage({ staff, onChange, onPreview }: {
  staff: StaffMember[];
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

  const visible = staff.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase()));
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
    update(member.id, row => ({ ...row, role: next, sections: roleDefaults(next) }));
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
      role, active: false, sections: roleDefaults(role) }]);
    setName(''); setEmail(''); setRole('promoter'); setShowNew(false); setError('');
  }

  function toggleSection(member: StaffMember, section: StaffSection) {
    update(member.id, row => ({ ...row, sections: row.sections.includes(section)
      ? row.sections.filter(value => value !== section) : [...row.sections, section] }));
  }

  function toggleActive(member: StaffMember) {
    if (member.role === 'admin' && member.active && activeAdmins.length === 1) {
      setError('No podés desactivar al único administrador activo.'); return;
    }
    update(member.id, row => ({ ...row, active: !row.active }));
    setError('');
  }

  return <section className="page-content permissions-page">
    <div className="page-heading"><div><div className="section-eyebrow">SEGURIDAD Y EQUIPO <span className="eyebrow-line"/></div>
      <h1>Usuarios y <span>permisos.</span></h1>
      <p>Definí quién puede entrar a cada área de MCF TICKETS.</p></div>
      <button className="btn btn-primary" onClick={() => { setShowNew(true); setError(''); }}><Plus size={17}/> Agregar persona</button>
    </div>

    <div className="permissions-warning"><CircleAlert size={19}/><div><strong>Esta pantalla es una vista de prueba.</strong>
      <p>Los usuarios de ejemplo no tienen contraseña ni acceso real. Para proteger los enlaces hay que conectar Supabase Auth y verificar permisos en el servidor. No compartas información de eventos reales todavía.</p>
    </div></div>

    <div className="permission-guide">
      <div className="permission-guide-item"><ShieldCheck size={22}/><strong>Administrador</strong><span>Acceso total: administración, permisos, públicos, tienda y lector.</span></div>
      <div className="permission-guide-item"><UsersRound size={22}/><strong>RR. PP.</strong><span>De forma predeterminada, solo el panel de venta por públicos.</span></div>
      <div className="permission-guide-item"><LockKeyhole size={22}/><strong>Personal de puerta</strong><span>De forma predeterminada, solo el lector QR.</span></div>
    </div>

    <section className="panel permissions-panel"><div className="panel-title"><div><h2>Equipo autorizado</h2>
      <p>Podés aprobar o suspender usuarios y elegir las áreas permitidas.</p></div>
      <input className="permission-search" aria-label="Buscar persona" placeholder="Buscar persona o correo" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {error && <div className="form-error permission-error"><CircleAlert size={16}/>{error}</div>}
      <div className="permissions-table-scroll"><table className="data-table permissions-table"><thead><tr>
        <th>PERSONA</th><th>ROL</th><th>PANEL RR. PP.</th><th>LECTOR QR</th><th>ACCESO</th><th>VISTA PREVIA</th>
      </tr></thead><tbody>{visible.map(member => <tr key={member.id}>
        <td><strong>{member.name}</strong><small className="table-secondary">{member.email}</small>{member.role === 'admin' && <small className="permission-full-access">Acceso completo</small>}</td>
        <td><select className="permission-role" aria-label={`Rol de ${member.name}`} value={member.role} onChange={e => changeRole(member, e.target.value as StaffRole)}>
          <option value="admin">Administrador</option><option value="promoter">RR. PP.</option><option value="scanner">Personal de puerta</option></select></td>
        {(['publicos', 'scanner'] as const).map(section => <td key={section}>
          <label className="permission-check"><input type="checkbox" aria-label={`${section === 'publicos' ? 'Panel RR. PP.' : 'Lector QR'} para ${member.name}`}
            checked={member.role === 'admin' || member.sections.includes(section)} disabled={member.role === 'admin'} onChange={() => toggleSection(member, section)}/>
            <span>{member.role === 'admin' ? 'Siempre' : member.sections.includes(section) ? 'Permitido' : 'Bloqueado'}</span></label>
        </td>)}
        <td><button className={`permission-status ${member.active ? 'permission-active' : 'permission-pending'}`} onClick={() => toggleActive(member)}>
          {member.active ? <><Check size={14}/> Activo</> : <><X size={14}/> Pendiente / bloqueado</>}</button></td>
        <td><button className="adm-open-qr" disabled={!member.active} onClick={() => onPreview(member.id)}><Eye size={15}/> Probar acceso</button></td>
      </tr>)}
      {!visible.length && <tr><td colSpan={6} className="adm-empty">No encontramos personas con esa búsqueda.</td></tr>}
      </tbody></table></div>
      <div className="adm-data-note"><LockKeyhole size={16}/><span>La tienda online es pública para compradores sin sesión. Los perfiles RR. PP. y puerta no verán ese módulo dentro del área de trabajo. La administración y la gestión de permisos son exclusivas del rol administrador.</span></div>
    </section>

    {showNew && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setShowNew(false); }}><form className="modal-card permission-modal" onSubmit={addMember}>
      <div className="modal-header"><div><h2>Agregar persona</h2><p>Prepará los permisos del nuevo integrante del equipo.</p></div>
        <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setShowNew(false)}><X size={19}/></button></div>
      <div className="form-stack"><label>Nombre y apellido<input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del colaborador"/></label>
        <label>Correo electrónico<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
        <label>Rol inicial<select value={role} onChange={e => setRole(e.target.value as StaffRole)}>
          <option value="promoter">RR. PP. — Panel de públicos</option><option value="scanner">Personal de puerta — Lector QR</option>
          <option value="admin">Administrador — Todas las áreas</option></select></label></div>
      <p className="adm-helper">Quedará pendiente hasta que lo apruebes. Esto no envía una invitación real ni crea una cuenta de Supabase.</p>
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
          <button className="btn btn-primary" onClick={() => { update(pendingAdminId, member => ({ ...member, role: 'admin', sections: roleDefaults('admin') })); setPendingAdminId(null); }}>
            Sí, dar acceso total</button></div>
      </div>
    </div>}
  </section>;
}
