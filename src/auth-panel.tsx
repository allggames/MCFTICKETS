import { useState } from 'react';
import { CircleAlert, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from './supabase';

export function SignInPanel({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setInfo('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError('No pudimos iniciar sesión. Revisá el correo, la contraseña y la confirmación del email.');
    setBusy(false);
  }

  async function resetPassword() {
    if (!supabase || !email.includes('@')) {
      setError('Escribí primero tu correo electrónico.'); return;
    }
    setBusy(true); setError(''); setInfo('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}?setup=1#/permisos`,
    });
    setBusy(false);
    if (resetError) setError('No se pudo solicitar el restablecimiento. Consultá al administrador.');
    else setInfo('Si ese correo tiene una cuenta, recibirá instrucciones para recuperar el acceso.');
  }

  return <section className="page-content auth-page">
    <div className="auth-card panel">
      <span className="auth-icon"><ShieldCheck size={28}/></span>
      <span className="section-eyebrow">MCF TICKETS · ACCESO PRIVADO</span>
      <h1>Iniciar <span>sesión.</span></h1>
      <p>Ingresá con tu cuenta real. Los permisos se verifican en Supabase, no con el selector de prueba.</p>
      <form className="form-stack" onSubmit={signIn}>
        <label><Mail size={15}/> Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
        <label><KeyRound size={15}/> Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña"/></label>
        {error && <div className="form-error"><CircleAlert size={16}/>{error}</div>}
        {info && <div className="auth-success"><Mail size={16}/>{info}</div>}
        <button className="btn btn-primary full-width" type="submit" disabled={busy || !supabase}>{busy ? 'Comprobando acceso…' : 'Ingresar a MCF TICKETS'}</button>
      </form>
      <button className="auth-inline" type="button" disabled={busy} onClick={resetPassword}>¿Olvidaste tu contraseña?</button>
      <div className="auth-demo-separator"><LockKeyhole size={16}/> ¿Todavía no tenés tu cuenta? El administrador debe invitarte.</div>
      <button className="btn btn-secondary full-width" onClick={onDemo}>Volver a la demostración</button>
    </div>
  </section>;
}

export function SetPasswordPanel({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 12) { setError('Elegí una contraseña de al menos 12 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError('No pudimos guardar la contraseña. Intentá de nuevo desde el enlace de tu correo.'); return; }
    onComplete();
  }
  return <section className="page-content auth-page"><div className="auth-card panel">
    <span className="auth-icon"><KeyRound size={28}/></span><span className="section-eyebrow">MCF TICKETS · CUENTA PERSONAL</span>
    <h1>Elegí tu <span>contraseña.</span></h1>
    <p>El enlace del correo verificó tu acceso. La contraseña se guarda en Supabase Auth y no se muestra al administrador.</p>
    <form className="form-stack" onSubmit={save}>
      <label>Nueva contraseña<input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 12 caracteres"/></label>
      <label>Confirmar contraseña<input required type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
      {error && <p className="form-error"><CircleAlert size={15}/>{error}</p>}
      <button className="btn btn-primary full-width" disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
    </form>
  </div></section>;
}
