import { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, LockKeyhole, Mail, Plus, RefreshCw, ShieldCheck, UsersRound, X } from 'lucide-react';
import { dateLabel } from './data';
import { supabase } from './supabase';

type Profile = { id: string; display_name: string; role: 'admin' | 'promoter' | 'scanner'; active: boolean; created_at: string };
type DbEvent = { id: string; title: string; starts_at: string; status: string };
type Assignment = { event_id: string; user_id: string; can_issue_paid: boolean; courtesy_limit: number; courtesy_used: number };

export function LiveAdministration({ currentId, onRefresh }: { currentId: string; onRefresh: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'promoter'>('promoter');
  const [confirmRole, setConfirmRole] = useState<{ member: Profile; role: 'admin' | 'promoter' } | null>(null);
  const [quotaDraft, setQuotaDraft] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError('');
    const [p, e, a, u] = await Promise.all([
      supabase.from('profiles').select('id,display_name,role,active,created_at').order('created_at'),
      supabase.from('events').select('id,title,starts_at,status').order('starts_at', { ascending: false }),
      supabase.from('event_staff').select('event_id,user_id,can_issue_paid,courtesy_limit,courtesy_used'),
      supabase.functions.invoke<{ users: Array<{ id: string; email?: string }> }>('manage-staff', { body: { action: 'list' } }),
    ]);
    const failure = p.error ?? e.error ?? a.error;
    if (failure) setError('No pudimos cargar los datos de Supabase. Revisá tu sesión y tus permisos.');
    else {
      setProfiles((p.data ?? []) as Profile[]);
      setEvents((e.data ?? []) as DbEvent[]);
      setAssignments((a.data ?? []) as Assignment[]);
      if (!u.error && u.data?.users) setEmails(Object.fromEntries(u.data.users.map(item => [item.id, item.email ?? ''])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedEvent = events.find(item => item.id === selectedEventId) ?? events[0];
  const filtered = profiles.filter(p => `${p.display_name} ${emails[p.id] ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const adminCount = profiles.filter(p => p.active && p.role === 'admin').length;
  const assigned = (memberId: string) => assignments.find(item => item.event_id === selectedEvent?.id && item.user_id === memberId);

  async function saveProfile(member: Profile, edit: Partial<Pick<Profile, 'active' | 'role'>>) {
    if (!supabase) return;
    if (member.id === currentId && (edit.active === false || (edit.role && edit.role !== 'admin'))) {
      setError('No podés quitarte tu propio acceso de administrador.'); return;
    }
    if (member.role === 'admin' && member.active && adminCount <= 1 &&
      (edit.active === false || (edit.role && edit.role !== 'admin'))) {
      setError('Debe quedar al menos un administrador activo.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    const { data, error: updateError } = await supabase.from('profiles').update(edit)
      .eq('id', member.id).select('id').single();
    if (updateError || !data) setError('No se pudo actualizar el usuario. Revisá sus permisos.');
    else { setNotice('Usuario actualizado en Supabase.'); await refresh(); onRefresh(); }
    setBusy(false);
  }

  async function saveAssignment(member: Profile, edit: { paid?: boolean; quota?: number }) {
    if (!supabase || !selectedEvent) return;
    const old = assigned(member.id);
    const paid = edit.paid ?? old?.can_issue_paid ?? false;
    const used = old?.courtesy_used ?? 0;
    const quota = edit.paid === false ? used : (edit.quota ?? old?.courtesy_limit ?? 0);
    if (!Number.isSafeInteger(quota) || quota < used || quota > 100000) {
      setError(`El cupo de invitaciones debe estar entre ${used} y 100.000.`); return;
    }
    setBusy(true); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('event_staff').upsert({
      event_id: selectedEvent.id, user_id: member.id, can_issue_paid: paid,
      courtesy_limit: quota, courtesy_used: used,
    }, { onConflict: 'event_id,user_id' });
    if (updateError) setError('No se pudieron guardar los permisos de ese evento.');
    else { setNotice(`Permisos de ${member.display_name} guardados.`); await refresh(); onRefresh(); }
    setBusy(false);
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    const { error: functionError } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'invite', name: inviteName.trim(), email: inviteEmail.trim().toLowerCase(), role: inviteRole },
    });
    if (functionError) setError('No se pudo enviar la invitación. Puede existir otra cuenta con ese correo o faltar la configuración de emails.');
    else {
      setNotice(`Se solicitó la invitación a ${inviteEmail.trim()}. El usuario quedará inactivo hasta que lo habilites.`);
      setInviteName(''); setInviteEmail(''); setInviteRole('promoter'); setShowInvite(false);
      await refresh();
    }
    setBusy(false);
  }

  return <section className="page-content permissions-page live-admin-page">
    <div className="page-heading"><div><div className="section-eyebrow">SUPABASE AUTH · ADMINISTRACIÓN REAL <span className="eyebrow-line"/></div>
      <h1>Panel de <span>administración.</span></h1>
      <p>Usuarios, accesos y autorizaciones guardados en MCF TICKETS, no en este navegador.</p></div>
      <button className="btn btn-primary" onClick={() => { setShowInvite(true); setError(''); }}><Plus size={16}/> Invitar usuario</button>
    </div>
    <div className="live-admin-notice"><ShieldCheck size={19}/><span><strong>Modo real:</strong> el acceso requiere una cuenta de Supabase. Las invitaciones envían un correo para que cada usuario establezca su contraseña. Los eventos de la demo local todavía no aparecen acá.</span>
      <button type="button" className="btn btn-secondary" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={15}/> Actualizar</button></div>
    {error && <p className="form-error live-admin-message"><CircleAlert size={16}/>{error}</p>}
    {notice && <p className="auth-success live-admin-message"><Check size={16}/>{notice}</p>}
    <div className="public-stats live-admin-stats">
      <div className="small-stat"><span>Usuarios registrados</span><strong>{profiles.length}</strong><UsersRound size={22}/></div>
      <div className="small-stat"><span>Usuarios activos</span><strong>{profiles.filter(p => p.active).length}</strong><ShieldCheck size={22}/></div>
      <div className="small-stat"><span>Administradores activos</span><strong>{adminCount}</strong><LockKeyhole size={22}/></div>
    </div>
    <section className="panel permissions-panel"><div className="panel-title"><div><h2>Gestión de usuarios</h2><p>Las altas se realizan por invitación. El permiso de acceso se activa por separado.</p></div>
      <input className="permission-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre"/></div>
      {loading ? <p className="adm-helper">Cargando usuarios de Supabase…</p> : <div className="permissions-table-scroll"><table className="data-table permissions-table"><thead><tr><th>USUARIO</th><th>ROL</th><th>ESTADO</th><th>CREADO</th></tr></thead><tbody>
        {filtered.map(member => <tr key={member.id}><td><strong>{member.display_name || 'Sin nombre'}</strong><small className="table-secondary">{emails[member.id] || (member.id === currentId ? 'Tu cuenta' : member.id.slice(0,8).toUpperCase())}</small></td>
          <td><select className="permission-role" value={member.role} disabled={busy || member.role === 'scanner'} onChange={e => setConfirmRole({ member, role: e.target.value as 'admin' | 'promoter' })} aria-label={`Rol de ${member.display_name}`}>
            <option value="admin">Administrador</option><option value="promoter">RR. PP.</option>{member.role === 'scanner' && <option value="scanner">Lector (reservado)</option>}</select></td>
          <td><button className={`permission-status ${member.active ? 'permission-active' : 'permission-pending'}`} disabled={busy || member.id === currentId} onClick={() => void saveProfile(member, { active: !member.active })}>
            {member.active ? <><Check size={14}/> Activo</> : <><X size={14}/> Desactivado</>}</button></td>
          <td>{dateLabel(member.created_at.slice(0,10))}</td></tr>)}
        {!filtered.length && <tr><td colSpan={4} className="adm-empty">No hay usuarios con esa búsqueda.</td></tr>}
      </tbody></table></div>}
    </section>
    <section className="panel permissions-event-panel"><div className="panel-title"><div><h2>Permisos por evento</h2><p>Habilitá ventas y fijá el cupo de invitaciones de cada RR. PP. por separado.</p></div></div>
      {!events.length ? <div className="live-admin-empty"><CircleAlert size={21}/><div><strong>Todavía no hay eventos reales en Supabase.</strong><p>Los eventos que ves en el Panel de eventos son de prueba. En la próxima etapa sincronizaremos los eventos para que puedas asignarlos a cada RR. PP.</p></div></div> : <>
        <div className="permissions-event-controls"><label>EVENTO<select value={selectedEvent?.id ?? ''} onChange={e => setSelectedEventId(e.target.value)}>
          {events.map(item => <option key={item.id} value={item.id}>{item.title} · {dateLabel(item.starts_at.slice(0,10))}</option>)}</select></label></div>
        <div className="permissions-table-scroll"><table className="data-table permissions-table"><thead><tr><th>RR. PP.</th><th>VENTAS</th><th>CUPO DE INVITACIONES</th><th>EMITIDAS</th></tr></thead><tbody>
          {profiles.filter(member => member.role === 'promoter').map(member => {
            const assignment = assigned(member.id);
            const sales = Boolean(assignment?.can_issue_paid);
            const quota = quotaDraft[member.id] ?? String(assignment?.courtesy_limit ?? 0);
            return <tr key={member.id}><td><strong>{member.display_name}</strong><small className="table-secondary">{member.active ? 'Activo' : 'Cuenta bloqueada'}</small></td>
              <td><label className="permission-check"><input type="checkbox" checked={sales} disabled={busy} onChange={e => void saveAssignment(member, { paid: e.target.checked })}/><span>{sales ? 'Habilitado' : 'Sin acceso'}</span></label></td>
              <td><div className="live-quota-edit"><input type="number" min={assignment?.courtesy_used ?? 0} max={100000} step="1" value={quota} disabled={busy || !sales} aria-label={`Cupo de invitaciones de ${member.display_name}`}
                onChange={e => setQuotaDraft(v => ({ ...v, [member.id]: e.target.value }))}/>
                <button className="btn btn-secondary" disabled={busy || !sales || quota === String(assignment?.courtesy_limit ?? 0)} onClick={() => void saveAssignment(member, { quota: Number(quota) })}>Guardar</button></div></td>
              <td>{assignment?.courtesy_used ?? 0} / {assignment?.courtesy_limit ?? 0}</td></tr>;
          })}
        </tbody></table></div>
        <p className="adm-helper">Cupo 0 = sin invitaciones. Si retirás las ventas, también se impide emitir nuevas cortesías. Solo un administrador puede cambiar estos valores.</p>
      </>}
    </section>
    {showInvite && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setShowInvite(false); }}><form className="modal-card permission-modal" onSubmit={inviteMember}>
      <div className="modal-header"><div><h2>Invitar nuevo usuario</h2><p>Recibirá un correo para establecer su propia contraseña.</p></div><button className="icon-button" type="button" onClick={() => setShowInvite(false)} aria-label="Cerrar"><X size={18}/></button></div>
      <div className="form-stack"><label>Nombre y apellido<input required minLength={2} maxLength={120} value={inviteName} onChange={e => setInviteName(e.target.value)}/></label>
        <label>Correo electrónico<input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/></label>
        <label>Rol inicial<select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'admin' | 'promoter')}><option value="promoter">RR. PP.</option><option value="admin">Administrador · acceso completo</option></select></label></div>
      <p className="adm-helper"><Mail size={15}/> El usuario se crea desactivado: deberás activarlo desde la tabla para que pueda ingresar.</p>
      {error && <p className="form-error"><CircleAlert size={15}/>{error}</p>}
      <div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={() => setShowInvite(false)}>Cancelar</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar invitación'}</button></div>
    </form></div>}
    {confirmRole && <div className="modal-layer"><div className="modal-card permission-modal" role="dialog" aria-modal="true" aria-labelledby="live-role-title">
      <div className="modal-header"><div><h2 id="live-role-title">¿Cambiar el rol de {confirmRole.member.display_name}?</h2></div></div>
      <p className="permission-confirm-text">{confirmRole.role === 'admin' ? 'Le darás acceso a todos los eventos, todos los QR y la administración de cuentas.' : 'Pasará a RR. PP. y perderá acceso a la administración. Sus permisos de eventos se controlan por separado.'}</p>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setConfirmRole(null)}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy} onClick={async () => { await saveProfile(confirmRole.member, { role: confirmRole.role }); setConfirmRole(null); }}>Confirmar cambio de rol</button></div>
    </div></div>}
  </section>;
}
