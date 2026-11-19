import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import {
  Activity, ArrowRight, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  Clock3, Copy, CreditCard, Download, Fingerprint, LayoutDashboard, LockKeyhole,
  Mail, Menu, MoreHorizontal, Plus, QrCode, Search, ShieldCheck, ShoppingBag,
  Smartphone, Sparkles, Ticket as TicketIcon, TicketCheck, UserRoundPlus, UsersRound, Settings2,
  Wallet, X, XCircle,
} from 'lucide-react';
import {
  dateLabel, demoStaff, eventPublicUrl, formatMoney, loadStore, makeDemoTicket, sellableTiers,
  type EventItem, type StaffMember, type Store, type Ticket,
} from './data';
import { AdminEventManager } from './admin-management';
import { EventCreateForm } from './event-create';
import { canAccessPage, canIssueInvitation, canSellEvent, PermissionsPage, staffRoleLabel, type WorkspacePage } from './permissions';
import './styles.css';

type Page = WorkspacePage;
type IconComponent = typeof TicketIcon;

function getPage(): Page {
  const slug = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return slug === 'eventos' || slug === 'publicos' || slug === 'scanner' || slug === 'permisos' ? slug : 'admin';
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><span className="brand-mark"><TicketCheck size={compact ? 18 : 22} strokeWidth={2.5}/></span><span className="brand-name">MCF <strong>TICKETS</strong></span></span>;
}

function Pill({ children, tone = 'purple' }: { children: React.ReactNode; tone?: 'purple' | 'green' | 'yellow' | 'red' | 'neutral' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '' }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} ${className}`.trim()}>{children}</button>;
}

function Metric({ label, value, icon: Icon, annotation, color = 'purple' }: {
  label: string; value: string; icon: IconComponent; annotation: string; color?: string;
}) {
  return <div className="metric-card"><div className="metric-head"><span>{label}</span><span className={`metric-icon icon-${color}`}><Icon size={19}/></span></div>
    <div className="metric-value">{value}</div><div className="metric-foot"><span className="mini-dot"/>{annotation}</div></div>;
}

const menu: { id: Page; name: string; icon: IconComponent; detail: string }[] = [
  { id: 'admin', name: 'Panel de eventos', icon: LayoutDashboard, detail: 'Control general' },
  { id: 'eventos', name: 'Venta online', icon: ShoppingBag, detail: 'Tienda pública' },
  { id: 'publicos', name: 'Panel de públicos', icon: UsersRound, detail: 'Ventas y cortesías' },
  { id: 'scanner', name: 'Lector QR', icon: QrCode, detail: 'Control de acceso' },
  { id: 'permisos', name: 'Usuarios y permisos', icon: Settings2, detail: 'Seguridad y equipo' },
];

function Sidebar({ page, setPage, open, setOpen, user, staff, previewId, onPreview }: {
  page: Page; setPage: (p: Page) => void; open: boolean; setOpen: (v: boolean) => void;
  user: StaffMember | null; staff: StaffMember[]; previewId: string; onPreview: (id: string) => void;
}) {
  return <>
    {open && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)}/>}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand/><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20}/></button></div>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav aria-label="Secciones principales" className="main-nav">{menu.filter(item => canAccessPage(user, item.id)).map(item => <a key={item.id} href={`#/${item.id}`} className={`nav-item ${page === item.id ? 'nav-active' : ''}`} onClick={() => { setPage(item.id); setOpen(false); }}>
        <item.icon size={19}/><span>{item.name}</span>{page === item.id && <span className="nav-rail"/>}
      </a>)}</nav>
      <div className="sidebar-caption bottom-caption">PLATAFORMA</div>
      <div className="side-info"><ShieldCheck size={17}/><div><strong>Proyecto MCF</strong><small>Versión de desarrollo</small></div></div>
      <div className="sidebar-spacer"/>
      <div className="sidebar-help"><div className="help-orb"><Sparkles size={20}/></div><strong>Todo en un mismo lugar.</strong><span>Creá eventos, gestioná ventas y validá ingresos.</span><span className="help-tag">MCF TICKETS · V1</span></div>
      <div className="demo-profile-picker"><label htmlFor="demo-profile-select">PROBAR PERMISOS · DEMO</label>
        <select id="demo-profile-select" aria-label="Elegir perfil de prueba" value={previewId} onChange={e => onPreview(e.target.value)}>
          <option value="guest">Visitante sin cuenta</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name} · {staffRoleLabel(member.role)}</option>)}
        </select><small>Simulador de navegación. No es un inicio de sesión seguro.</small></div>
      <div className="user-row"><div className="user-avatar">{user?.name.slice(0,2).toUpperCase() ?? 'MC'}</div><div><strong>{user?.name ?? 'Visitante'}</strong><small>{user ? staffRoleLabel(user.role) : 'Tienda pública'} · Demo</small></div><MoreHorizontal size={17}/></div>
    </aside>
  </>;
}

function Topbar({ page, setOpen }: { page: Page; setOpen: (v: boolean) => void }) {
  const current = menu.find(item => item.id === page)!;
  return <header className="topbar"><div className="crumbs"><button className="menu-toggle" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button><span>MCF Workspace</span><ChevronRight size={15}/><strong>{current.name}</strong></div>
    <div className="top-actions"><span className="top-mode"><span/> ENTORNO DEMO</span><span className="round-avatar">MC</span></div></header>;
}

function EventArtwork({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  return <div className={`event-art event-art-${event.id === 'neon-night' ? 'neon' : event.id === 'sunset' ? 'sunset' : 'midnight'} ${compact ? 'event-art-compact' : ''}`}>
    {event.imageUrl && <img className="event-art-cover" src={event.imageUrl} alt=""/>}
    <span className="art-grid"/><span className="art-glow"/><span className="art-lines"/>
    <div className="art-inner"><span className="art-eyebrow">MCF PRESENTA</span><strong>{event.title}</strong><small>{event.description || event.subtitle}</small></div>
    <span className="art-corner">MCF / 2026—27</span>
  </div>;
}

function EventTable({ events, tickets, selectedId, onSelect, onPublish, onClose }: {
  events: EventItem[]; tickets: Ticket[]; selectedId: string;
  onSelect: (id: string) => void; onPublish: (id: string) => void; onClose: (id: string) => void;
}) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>EVENTO</th><th>FECHA</th><th>TICKETS VENDIDOS</th><th>INGRESOS REGISTRADOS*</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>
    {events.map(event => {
      const rows = tickets.filter(t => t.eventId === event.id);
      const sales = rows.filter(t => t.status !== 'void' && t.source !== 'cortesia' && t.paymentStatus !== 'refunded');
      const money = sales.reduce((n, t) => n + t.price, 0);
      return <tr key={event.id} className={selectedId === event.id ? 'adm-selected-event' : ''}><td><button className="adm-event-name" onClick={() => onSelect(event.id)}><div className="table-event"><span className="event-initial" style={{ background: event.accent }}>{event.title.substring(0, 1)}</span><span><strong>{event.title}</strong><small>{event.venue}</small></span></div></button></td>
        <td>{dateLabel(event.date)}</td><td><strong>{sales.length}</strong><span className="subtle"> / {event.tiers.reduce((n, t) => n + t.capacity, 0)} cupos</span></td><td className="money-cell">{formatMoney(money)}</td><td><Pill tone={event.status === 'published' ? 'green' : event.status === 'draft' ? 'yellow' : 'neutral'}>{event.status === 'published' ? 'Publicado' : event.status === 'draft' ? 'Borrador' : 'Cerrado'}</Pill></td>
        <td><div className="adm-event-actions"><button className="adm-open-qr" onClick={() => onSelect(event.id)}>Gestionar</button>
          {event.status === 'draft' && <button className="adm-event-publish" onClick={() => onPublish(event.id)}>Publicar</button>}
          {event.status === 'published' && <button className="adm-event-close" onClick={() => onClose(event.id)}>Cerrar evento</button>}
          {event.status === 'closed' && <span className="adm-history-label">En historial</span>}
          <button className="adm-event-copy" title="Copiar URL pública" aria-label={`Copiar URL de ${event.title}`} onClick={() => navigator.clipboard?.writeText(eventPublicUrl(event))}><Copy size={15}/></button>
        </div></td></tr>;
    })}
  </tbody></table></div>;
}

function AdminPage({ store, updateStore }: { store: Store; updateStore: (next: Store) => void }) {
  const [view, setView] = useState<'mine' | 'create'>('mine');
  const [selectedEventId, setSelectedEventId] = useState(store.events[0]?.id ?? '');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [closeConfirmId, setCloseConfirmId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EventItem['status']>('all');
  const revenue = store.tickets.filter(t => t.status !== 'void' && t.paymentStatus === 'approved').reduce((sum, ticket) => sum + ticket.price, 0);
  const reported = store.tickets.filter(t => t.status !== 'void' && t.paymentStatus === 'reported').reduce((sum, ticket) => sum + ticket.price, 0);
  const soldTickets = store.tickets.filter(ticket => ticket.status !== 'void' && ticket.source !== 'cortesia' && ticket.paymentStatus !== 'refunded');
  const checked = store.tickets.filter(ticket => ticket.status === 'used').length;
  const selectedEvent = store.events.find(event => event.id === selectedEventId) ?? store.events[0];
  const visibleEvents = store.events.filter(event => event.title.toLowerCase().includes(q.toLowerCase()) &&
    (statusFilter === 'all' || event.status === statusFilter)).slice().sort((a, b) => b.date.localeCompare(a.date));
  const bySource = ['online', 'publico', 'cortesia'].map(source => ({ source, count: store.tickets.filter(ticket => ticket.source === source).length }));
  const maxSource = Math.max(1, ...bySource.map(source => source.count));

  function createEvent(event: EventItem) {
    updateStore({ ...store, events: [...store.events, event] });
    setSelectedEventId(event.id);
    setStatusFilter('all');
    setView('mine');
  }
  function publishEvent(id: string) {
    updateStore({ ...store, events: store.events.map(event => event.id === id && event.status === 'draft'
      ? { ...event, status: 'published' as const } : event) });
  }
  function closeEvent(id: string) {
    updateStore({ ...store, events: store.events.map(event => event.id === id && event.status === 'published'
      ? { ...event, status: 'closed' as const } : event) });
    setCloseConfirmId(null);
  }

  return <section className="page-content">
    <div className="page-heading"><div><div className="section-eyebrow">GESTIÓN DE EVENTOS <span className="eyebrow-line"/></div>
      <h1>Panel de <span>eventos.</span></h1><p>Creá eventos, organizá lotes y consultá tus ventas e historial.</p></div>
      {view === 'mine' && <Button onClick={() => setView('create')}><Plus size={18}/> Crear evento</Button>}</div>
    <div className="event-admin-tabs" role="tablist" aria-label="Panel de eventos">
      <button role="tab" aria-selected={view === 'mine'} className={view === 'mine' ? 'event-admin-tab-active' : ''} onClick={() => setView('mine')}><CalendarDays size={17}/> Mis eventos <span>{store.events.length}</span></button>
      <button role="tab" aria-selected={view === 'create'} className={view === 'create' ? 'event-admin-tab-active' : ''} onClick={() => setView('create')}><Plus size={17}/> Crear evento</button>
    </div>
    <div className="demo-note"><CircleAlert size={17}/><span>Datos de demostración. Todavía no se cobran pagos ni se envían correos reales.</span></div>
    {view === 'create' ? <EventCreateForm existing={store.events} onCreate={createEvent}/> : <>
    <div className="metrics-grid"><Metric label="Eventos totales" value={String(store.events.length)} icon={CalendarDays} annotation={`${store.events.filter(e => e.status === 'closed').length} en historial cerrado`}/>
      <Metric label="Tickets vendidos" value={String(soldTickets.length)} icon={TicketIcon} annotation="No incluye cortesías" color="blue"/>
      <Metric label="Ingresos registrados*" value={formatMoney(revenue + reported)} icon={Wallet} annotation="Online simulados + públicos informados" color="green"/>
      <Metric label="Eventos publicados" value={String(store.events.filter(e => e.status === 'published').length)} icon={TicketCheck} annotation="Disponibles para compradores" color="orange"/></div>
    <div className="dashboard-panels"><section className="panel revenue-panel"><div className="panel-title"><div><h2>Resumen de emisiones</h2><p>Origen de las entradas generadas</p></div><span className="tiny-pill">Todos los eventos <ChevronDown size={13}/></span></div>
      <div className="source-bars">{bySource.map(({ source, count }) => <div className="bar-row" key={source}><span>{source === 'online' ? 'Venta online' : source === 'publico' ? 'Públicos' : 'Cortesías'}</span><div className="bar-track"><div className={`bar-fill bar-${source}`} style={{ width: `${count / maxSource * 100}%` }}/></div><strong>{count}</strong></div>)}</div>
      <div className="panel-total"><span>Total de ventas registradas (demo)</span><strong>{formatMoney(revenue + reported)}</strong></div>
    </section><section className="panel insights-panel"><div className="panel-title"><div><h2>Estado de accesos</h2><p>Seguimiento de QR en tiempo real*</p></div><Activity size={21} color="#a88afd"/></div><div className="donut-row"><div className="donut" style={{ '--used': `${(checked / Math.max(1, store.tickets.length)) * 100}%` } as React.CSSProperties}><div><strong>{Math.round((checked / Math.max(1, store.tickets.length)) * 100)}%</strong><small>utilizados</small></div></div><div className="donut-legend"><span><i className="legend-purple"/>Por ingresar <strong>{store.tickets.filter(t => t.status === 'valid').length}</strong></span><span><i className="legend-green"/>Ingresaron <strong>{checked}</strong></span><span><i className="legend-muted"/>Anulados <strong>{store.tickets.filter(t => t.status === 'void').length}</strong></span></div></div><small className="insights-note">* En la demo, los cambios se guardan en este navegador.</small></section></div>
    <section className="panel events-panel"><div className="panel-title table-title"><div><h2>Mis eventos · Historial</h2><p>Incluye próximos eventos, borradores y fiestas cerradas. Seleccioná uno para ver sus lotes y números.</p></div>
      <div className="event-history-filters"><label className="search-box"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar evento" aria-label="Buscar evento"/></label>
      <select aria-label="Filtrar eventos por estado" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
        <option value="all">Todos los eventos</option><option value="published">Publicados</option><option value="draft">Borradores</option><option value="closed">Cerrados</option></select></div></div>
      <EventTable events={visibleEvents} tickets={store.tickets} selectedId={selectedEvent?.id ?? ''}
        onSelect={setSelectedEventId} onPublish={publishEvent} onClose={setCloseConfirmId}/></section>
    {selectedEvent && <AdminEventManager key={selectedEvent.id} event={selectedEvent} existingEvents={store.events} tickets={store.tickets}
      onChange={next => updateStore({ ...store, events: store.events.map(e => e.id === next.id ? next : e) })}
      onViewTicket={setSelectedTicket}/>}
    <div className="bottom-hint"><Fingerprint size={17}/><span>* Ingresos brutos informados en modo demo. No son ganancias netas ni cobros comprobados; falta conciliar pagos y descuentos de Mercado Pago.</span></div>
    </>}
    {closeConfirmId && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setCloseConfirmId(null); }}>
      <div className="modal-card adm-manual-confirm" role="dialog" aria-modal="true" aria-labelledby="close-event-heading">
        <div className="modal-header"><div><h2 id="close-event-heading">¿Cerrar todas las ventas de este evento?</h2>
          <p>{store.events.find(event => event.id === closeConfirmId)?.title}</p></div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setCloseConfirmId(null)}><X size={19}/></button></div>
        <p className="adm-manual-description">Esta acción es diferente a marcar SOLD OUT un lote. Cerrará las ventas online y por RR. PP. de <strong>todos los lotes de este evento</strong>, sin afectar otras fiestas. Los QR ya emitidos conservarán su validez y el evento seguirá visible en tu historial.</p>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setCloseConfirmId(null)}>Cancelar</button>
          <button className="btn btn-soldout" onClick={() => closeEvent(closeConfirmId)}>Sí, cerrar evento</button></div>
      </div>
    </div>}
    {selectedTicket && selectedEvent && <TicketDialog ticket={selectedTicket} event={selectedEvent} onClose={() => setSelectedTicket(null)}/>}
  </section>;
}

function TicketDialog({ ticket, event, onClose }: { ticket: Ticket; event: EventItem; onClose: () => void }) {
  const [qr, setQr] = useState('');
  useEffect(() => { let live = true; QRCode.toDataURL(ticket.token, { width: 440, margin: 2, color: { dark: '#131324', light: '#ffffff' } }).then(url => { if (live) setQr(url); }); return () => { live = false; }; }, [ticket.token]);
  const sector = event.tiers.find(t => t.id === ticket.tierId);
  const tier = sector?.name ?? 'Entrada';
  const batch = event.batches.find(b => b.id === sector?.batchId)?.name ?? 'Lote';
  return <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="ticket-dialog"><button className="ticket-close" onClick={onClose} aria-label="Cerrar"><X size={22}/></button><div className="ticket-dialog-top"><Brand compact/><Pill tone="purple">ENTRADA DEMO</Pill></div><div className="ticket-hero"><span>ENTRADA PARA</span><h2>{event.title}</h2><p>{dateLabel(event.date)} · {event.time} hs</p></div><div className="ticket-qr">{qr && <img src={qr} alt="Código QR de prueba"/>}<span>Escaneá este código en el lector de prueba</span></div><div className="ticket-fields"><div><small>TITULAR</small><strong>{ticket.holder}</strong></div><div><small>LOTE · SECTOR</small><strong>{batch} · {tier}</strong></div><div><small>CÓDIGO</small><strong>{ticket.id.slice(0, 8).toUpperCase()}</strong></div><div><small>ESTADO</small><strong>{ticket.status === 'valid' ? 'Válido' : ticket.status === 'used' ? 'Utilizado' : 'Anulado'}</strong></div><div><small>GENERADO POR</small><strong>{ticket.source === 'online' ? 'Tienda MCF' : ticket.promoter || 'Sin asignar'}</strong></div><div><small>EMAIL DESTINO</small><strong>{ticket.email}</strong></div></div><div className="ticket-dialog-bottom"><Button variant="secondary" onClick={() => navigator.clipboard?.writeText(ticket.token)}><Copy size={17}/> Copiar QR</Button><a className="btn btn-primary" href={qr} download={`MCF-${ticket.id.slice(0, 8)}.png`}><Download size={17}/> Descargar</a></div><p className="ticket-disclaimer">QR de prueba: no permite el ingreso a un evento real ni se envía por correo.</p></div></div>;
}

// Los compradores y RR. PP. reciben solamente un comprobante sin token.
// El envío real del QR se hará exclusivamente en el servidor cuando haya correo configurado.
type EmailReceipt = Pick<Ticket, 'id' | 'holder' | 'email'>;

function EmailReceiptDialog({ receipt, event, source, onClose }: {
  receipt: EmailReceipt; event: EventItem; source: 'online' | 'publico'; onClose: () => void;
}) {
  return <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-card email-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="email-receipt-title">
      <button className="ticket-close" onClick={onClose} aria-label="Cerrar"><X size={22}/></button>
      <div className="email-receipt-icon"><Mail size={32}/></div>
      <Pill tone="green">REGISTRO DE PRUEBA</Pill>
      <h2 id="email-receipt-title">{source === 'online' ? 'Compra simulada registrada' : 'Solicitud de entrada registrada'}</h2>
      <p>El QR de ingreso debe enviarse exclusivamente al correo del titular. No se muestra ni se entrega al RR. PP.</p>
      <div className="email-receipt-details"><span>EVENTO</span><strong>{event.title}</strong>
        <span>TITULAR</span><strong>{receipt.holder}</strong>
        <span>CORREO DESTINO</span><strong>{receipt.email}</strong>
        <span>REFERENCIA</span><strong>{receipt.id.slice(0, 8).toUpperCase()}</strong></div>
      <div className="email-receipt-warning"><CircleAlert size={18}/><span><strong>Correo no enviado.</strong> Esto es una demostración: todavía no hay servicio de email conectado ni pago real confirmado.</span></div>
      <Button className="full-width" onClick={onClose}>Entendido <Check size={17}/></Button>
    </div>
  </div>;
}

function ShopPage({ store, addTicket }: { store: Store; addTicket: (ticket: Ticket) => void }) {
  const published = store.events.filter(event => event.status === 'published');
  const fromHash = () => {
    const slug = decodeURIComponent(window.location.hash.split('/')[2] ?? '');
    return published.find(event => (event.slug || event.id) === slug)?.id ?? null;
  };
  const [selected, setSelected] = useState<string | null>(fromHash);
  const [tierId, setTierId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ticket, setTicket] = useState<EmailReceipt | null>(null);
  const event = published.find(e => e.id === selected) ?? null;
  const availableTiers = event ? sellableTiers(event) : [];
  const tier = availableTiers.find(t => t.id === tierId) ?? availableTiers[0] ?? null;
  useEffect(() => {
    const sync = () => setSelected(fromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [store.events]);
  function chooseEvent(id: string) {
    const e = published.find(item => item.id === id);
    setSelected(id); setTierId(e ? sellableTiers(e)[0]?.id ?? '' : '');
    if (e) window.location.hash = `#/eventos/${encodeURIComponent(e.slug || e.id)}`;
  }
  function backToEvents() { setSelected(null); setTicket(null); window.location.hash = '#/eventos'; }
  function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !tier || !name.trim() || !email.includes('@')) return;
    if (store.tickets.filter(t => t.tierId === tier.id && t.status !== 'void').length >= tier.capacity) return;
    const newTicket = makeDemoTicket(event.id, tier.id, name.trim(), email.trim(), 'online', '', tier.price);
    addTicket(newTicket);
    setTicket({ id: newTicket.id, holder: newTicket.holder, email: newTicket.email });
  }

  return <section className="page-content"><div className="page-heading"><div><div className="section-eyebrow">MCF TICKETS <span className="eyebrow-line"/></div><h1>Viví el momento. <span>Elegí tu evento.</span></h1><p>Explorá los próximos eventos y elegí la entrada ideal.</p></div><Pill tone="purple"><Sparkles size={13}/> Compra online</Pill></div>
    <div className="demo-note"><CircleAlert size={17}/><span>Esta tienda es una demostración: no se cobra dinero y todavía no se envían entradas por email. El QR nunca se mostrará en el comprobante del comprador.</span></div>
    {!event ? <><div className="shop-feature"><div className="feature-copy"><Pill tone="purple">EXPERIENCIAS MCF</Pill><h2>Las mejores noches<br/><em>empiezan acá.</em></h2><p>Un lugar para todas tus experiencias. Elegí tu evento, tu sector y disfrutá.</p><div className="feature-stats"><span><strong>{published.length}</strong> EVENTOS DISPONIBLES</span><span><strong>100%</strong> DIGITAL</span></div></div><div className="feature-visual"><span className="feature-ring"/><TicketIcon size={112} strokeWidth={1} /></div></div><div className="section-row"><h2>Próximos eventos <span className="muted-count">{published.length}</span></h2><span className="subtle">Explorar todos</span></div><div className="event-card-grid">{published.map(item => <article className="shop-event-card" key={item.id}><EventArtwork event={item}/><div className="shop-event-body"><div className="event-card-meta"><CalendarDays size={14}/>{dateLabel(item.date)} <span>·</span> {item.time} hs</div><h3>{item.title}</h3><p>{item.venue} · {item.city}</p><div className="shop-event-bottom"><div><small>Desde</small><strong>{sellableTiers(item).length ? formatMoney(Math.min(...sellableTiers(item).map(t => t.price))) : 'Sin lote activo'}</strong></div><Button onClick={() => chooseEvent(item.id)}>Ver entradas <ArrowRight size={17}/></Button></div></div></article>)}</div></>
      : <><button className="back-link" onClick={backToEvents}><ChevronLeft size={17}/> Volver a eventos</button><div className="checkout-grid"><div><EventArtwork event={event}/><div className="panel event-description"><h2>{event.title}</h2><p>{event.description || event.subtitle}</p><div className="detail-row"><CalendarDays size={18}/>{dateLabel(event.date)} · {event.time} hs</div><div className="detail-row"><Smartphone size={18}/>{event.venue}, {event.city}</div><div className="detail-row"><Mail size={18}/> En la versión final, recibís tu QR por email.</div></div></div><form className="panel checkout-form" onSubmit={placeOrder}><div className="panel-title"><div><h2>Elegí tu entrada</h2><p>Seleccioná un sector para continuar</p></div></div><div className="tier-list">{availableTiers.map(t => { const remaining = t.capacity - store.tickets.filter(ticket => ticket.tierId === t.id && ticket.status !== 'void').length; return <label className={`tier-option ${tierId === t.id ? 'tier-selected' : ''}`} key={t.id}><input type="radio" name="tier" value={t.id} checked={tierId === t.id} disabled={remaining <= 0} onChange={() => setTierId(t.id)}/><span className="radio-fake"/><span><strong>{t.name}</strong><small>{remaining} disponibles</small></span><b>{t.price !== undefined ? formatMoney(t.price) : ''}</b></label>; })}</div>{!availableTiers.length && <p className="adm-helper">Todavía no hay un lote activo para este evento.</p>}<div className="divider"/><h3>Datos del titular</h3><div className="form-stack"><label>Nombre y apellido<input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo"/></label><label>Correo electrónico<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com"/></label></div><div className="checkout-summary"><span>Total de prueba</span><strong>{formatMoney(tier?.price ?? 0)}</strong></div><Button type="submit" className="full-width" disabled={!tier}><CreditCard size={18}/> Simular compra</Button><p className="checkout-note"><LockKeyhole size={14}/> Mercado Pago se conectará para la versión real.</p></form></div></>}
    {ticket && event && <EmailReceiptDialog receipt={ticket} event={event} source="online" onClose={() => setTicket(null)}/>}</section>;
}

function PublicPage({ store, user, addTicket }: { store: Store; user: StaffMember | null; addTicket: (ticket: Ticket) => void }) {
  const [eventId, setEventId] = useState('');
  const allowedEvents = store.events.filter(e => e.status === 'published' && canSellEvent(user, e.id));
  const event = allowedEvents.find(e => e.id === eventId) ?? allowedEvents[0];
  const activeTiers = event ? sellableTiers(event) : [];
  const [tierId, setTierId] = useState('');
  const [kind, setKind] = useState<'publico' | 'cortesia'>('publico');
  const [holder, setHolder] = useState('');
  const [email, setEmail] = useState('');
  // La autoría de las entradas proviene del perfil activo, no de un desplegable editable.
  const promoter = user?.name ?? '';
  const [generated, setGenerated] = useState<EmailReceipt | null>(null);
  const tier = activeTiers.find(t => t.id === tierId) ?? activeTiers[0];
  const canInvite = Boolean(event && canIssueInvitation(user, event.id));
  const issueKind = canInvite ? kind : 'publico';
  const issued = store.tickets.filter(t => t.promoter === promoter && canSellEvent(user, t.eventId));
  function changeEvent(id: string) { setEventId(id); setTierId(''); setGenerated(null); }
  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !tier || !canSellEvent(user, event.id) || !holder.trim() || !email.includes('@')) return;
    if (store.tickets.filter(t => t.tierId === tier.id && t.status !== 'void').length >= tier.capacity) return;
    // El permiso se verifica al emitir, no solamente al mostrar el botón.
    const authorizedKind = canIssueInvitation(user, event.id) ? issueKind : 'publico';
    const newTicket = makeDemoTicket(event.id, tier.id, holder.trim(), email.trim(), authorizedKind, promoter, authorizedKind === 'cortesia' ? 0 : tier.price);
    addTicket(newTicket);
    setGenerated({ id: newTicket.id, holder: newTicket.holder, email: newTicket.email });
    setHolder(''); setEmail('');
  }

  return <section className="page-content">
    <div className="page-heading"><div><div className="section-eyebrow">EQUIPO MCF <span className="eyebrow-line"/></div>
      <h1>Panel de <span>públicos.</span></h1><p>Registrá entradas para tus eventos. La entrega de QR será directa al correo del titular.</p></div>
      <Pill tone="purple"><UsersRound size={14}/> {user?.role === 'admin' ? 'Administrador' : 'RR. PP.'}</Pill></div>
    <div className="demo-note"><CircleAlert size={17}/><span>Simulación local: no se envían correos reales. Los QR no se muestran a los RR. PP. y el bloqueo definitivo debe implementarse en Supabase.</span></div>
    <div className="public-assignment"><ShieldCheck size={19}/><span><strong>{promoter}</strong> · {allowedEvents.length} evento{allowedEvents.length !== 1 ? 's' : ''} habilitado{allowedEvents.length !== 1 ? 's' : ''} para emitir entradas.</span></div>
    <div className="public-stats">
      <div className="small-stat"><span>Mis entradas emitidas</span><strong>{issued.length}</strong><TicketIcon size={22}/></div>
      <div className="small-stat"><span>Ventas registradas</span><strong>{formatMoney(issued.filter(t => t.source === 'publico').reduce((n,t)=>n+t.price,0))}</strong><Wallet size={22}/></div>
      <div className="small-stat"><span>Cortesías generadas</span><strong>{issued.filter(t=>t.source==='cortesia').length}</strong><Sparkles size={22}/></div>
    </div>
    {!allowedEvents.length && <div className="public-no-events"><LockKeyhole size={30}/>
      <h2>No tenés eventos habilitados</h2><p>El administrador debe autorizarte para una fiesta desde Usuarios y permisos. No podés generar entradas por ahora.</p></div>}
    {allowedEvents.length > 0 && <div className="public-layout">
      <form className="panel public-form" onSubmit={generate}><div className="panel-title"><div><h2><UserRoundPlus size={21}/> Nueva entrada</h2>
        <p>Registrada por {promoter}. El envío real del QR al cliente se activará con el servidor de correo.</p></div></div>
        <div className="form-stack">
          <label>Usuario emisor<input value={promoter} disabled aria-label="Usuario emisor"/></label>
          <label>Evento<select value={event?.id ?? ''} onChange={e=>changeEvent(e.target.value)}>
            {allowedEvents.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
          <label>Sector del lote activo<select value={tier?.id ?? ''} onChange={e=>setTierId(e.target.value)}>
            {activeTiers.map(t=><option key={t.id} value={t.id}>{t.name} — {formatMoney(t.price)}</option>)}</select></label>
          <div className="form-two"><label>Nombre y apellido<input required value={holder} onChange={e=>setHolder(e.target.value)} placeholder="Nombre del cliente"/></label>
            <label>Email del cliente<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="cliente@correo.com"/></label></div>
          <div className="issue-types"><label className={issueKind==='publico'?'issue-selected':''}><input type="radio" checked={issueKind==='publico'} onChange={()=>setKind('publico')}/>
            <CreditCard size={20}/><strong>Venta registrada</strong><small>{formatMoney(tier?.price??0)}</small></label>
            {canInvite && <label className={issueKind==='cortesia'?'issue-selected':''}><input type="radio" checked={issueKind==='cortesia'} onChange={()=>setKind('cortesia')}/>
              <Sparkles size={20}/><strong>Invitación / cortesía</strong><small>Sin cargo</small></label>}</div>
          {!canInvite && <div className="public-invite-restriction"><LockKeyhole size={15}/> Las invitaciones sin cargo están reservadas al administrador. Solo él puede habilitarte este permiso para el evento.</div>}
          <div className="public-email-policy"><Mail size={18}/><span>Esta pantalla no ofrece visualizar, descargar, copiar ni reenviar el QR. La entrega final será a <strong>la dirección del cliente</strong>; falta protegerlo también desde el servidor.</span></div>
          <Button type="submit" className="full-width" disabled={!tier}><Mail size={18}/> Registrar entrada para envío</Button>
        </div>
      </form>
      <section className="panel how-panel"><span className="how-icon"><ShieldCheck size={25}/></span><h2>Una entrada.<br/>Un código único.</h2>
        <p>Cada QR se vincula con un evento, sector, titular y usuario emisor.</p>
        <div className="how-steps"><div><span>01</span>Elegí evento autorizado <Check size={16}/></div>
          <div><span>02</span>Registrá los datos <Check size={16}/></div><div><span>03</span>Solicitá el envío por correo <Check size={16}/></div></div>
        <div className="how-warning"><CircleAlert size={16}/> En producción, las cortesías tendrán cupos y autorización del administrador.</div>
      </section>
    </div>}
    <section className="panel recent-panel"><div className="panel-title"><div><h2>Mis emisiones recientes</h2>
      <p>Entradas registradas por {promoter} para los eventos autorizados</p></div><Pill tone="purple">{issued.length} entradas</Pill></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>TITULAR</th><th>EVENTO</th><th>TIPO</th><th>ESTADO</th><th>CORREO</th></tr></thead>
        <tbody>{issued.slice().reverse().slice(0,8).map(t=><tr key={t.id}><td><strong>{t.holder}</strong><small className="table-secondary">{t.email}</small></td>
          <td>{store.events.find(e=>e.id===t.eventId)?.title}</td><td>{t.source==='cortesia'?'Cortesía':'Venta'}</td>
          <td><Pill tone={t.status==='valid'?'green':'neutral'}>{t.status==='valid'?'Válida':t.status==='used'?'Utilizada':'Anulada'}</Pill></td>
          <td><Pill tone={t.deliveryStatus === 'sent' ? 'green' : t.deliveryStatus === 'failed' ? 'red' : 'yellow'}>
            {t.deliveryStatus === 'sent' ? 'Enviado' : t.deliveryStatus === 'failed' ? 'Error' : t.deliveryStatus === 'queued' ? 'Pendiente' : 'No enviado'}</Pill></td></tr>)}</tbody>
      </table></div></section>
    {generated && event && canSellEvent(user,event.id) && <EmailReceiptDialog receipt={generated} event={event} source="publico" onClose={()=>setGenerated(null)}/>}
  </section>;
}

type ScanResult = { status: 'valid' | 'used' | 'invalid' | 'wrong-event'; ticket?: Ticket; event?: EventItem };

function ScannerPage({ store, redeem }: { store: Store; redeem: (token: string, eventId: string) => ScanResult }) {
  const [eventId, setEventId] = useState(store.events[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const callbackRef = useRef(redeem);
  const selectedEvent = store.events.find(e=>e.id===eventId);
  useEffect(()=>{callbackRef.current=redeem;},[redeem]);
  useEffect(() => { return () => { const scanner = scannerRef.current; if (scanner?.isScanning) void scanner.stop().catch(()=>{}).finally(()=>{ try { scanner.clear(); } catch { /* scanner already closed */ } }); }; }, []);
  async function openCamera() {
    if (cameraOpen) return;
    setCameraError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-camera', { verbose: false });
      scannerRef.current = scanner;
      await scanner.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 220, height: 220 } },
        decoded => { setResult(callbackRef.current(decoded, eventId)); }, () => {});
      setCameraOpen(true);
    } catch {
      setCameraError('No se pudo iniciar la cámara. Verificá los permisos y que estés usando HTTPS.');
      scannerRef.current = null;
    }
  }
  async function closeCamera() {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) await scanner.stop().catch(()=>{});
    try { scanner?.clear(); } catch { /* scanner already closed */ }
    scannerRef.current = null;
    setCameraOpen(false);
  }
  function testInput(e: React.FormEvent) { e.preventDefault(); setResult(redeem(input.trim(), eventId)); setInput(''); }
  const count = store.tickets.filter(t=>t.eventId===eventId && t.status==='used').length;
  return <section className="page-content"><div className="page-heading"><div><div className="section-eyebrow">CONTROL DE ACCESO <span className="eyebrow-line"/></div><h1>Escaneá. <span>Validá. Ingresá.</span></h1><p>Validación de códigos QR para el personal de puerta.</p></div><Pill tone="green"><span className="status-dot"/> Lector disponible</Pill></div><div className="demo-note"><CircleAlert size={17}/><span>El lector valida únicamente los QR de esta demo y desde este navegador. La verificación entre dispositivos se activará con Supabase.</span></div>
    <div className="scanner-layout"><div className="panel scanner-main"><div className="panel-title"><div><h2><QrCode size={21}/> Lector de entradas</h2><p>Seleccioná el evento antes de escanear</p></div></div><label className="scanner-select">Evento activo<select value={eventId} onChange={e=>{setEventId(e.target.value);setResult(null);if(cameraOpen)void closeCamera();}}>{store.events.filter(e=>e.status!=='closed').map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><div className={`scanner-viewport ${cameraOpen?'scanner-camera-on':''}`}><div id="qr-camera"/><div className="scan-placeholder" style={{display:cameraOpen?'none':undefined}}><div className="scan-frame"><span/><span/><span/><span/><QrCode size={75} strokeWidth={1.15}/></div><strong>Listo para escanear</strong><small>Usá la cámara de tu celular o ingresá un código</small></div></div><Button className="full-width" onClick={()=>void(cameraOpen?closeCamera():openCamera())}>{cameraOpen?<><X size={18}/> Detener cámara</>:<><Smartphone size={18}/> Activar cámara</>}</Button>{cameraError && <p className="form-error"><CircleAlert size={16}/>{cameraError}</p>}<div className="scanner-divider"><span/> O INGRESÁ EL CÓDIGO <span/></div><form className="manual-scan" onSubmit={testInput}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="MCF:DEMO:..." aria-label="Código QR" required/><Button type="submit"><Check size={18}/> Validar</Button></form></div>
      <aside className="scan-aside"><div className="panel scanner-event"><div className="panel-title"><div><h2>Evento seleccionado</h2><p>Información de la puerta</p></div></div>{selectedEvent && <><EventArtwork compact event={selectedEvent}/><h3>{selectedEvent.title}</h3><div className="scan-detail"><CalendarDays size={16}/>{dateLabel(selectedEvent.date)}</div><div className="scan-detail"><Clock3 size={16}/>{selectedEvent.time} hs</div></>}<div className="scan-counter"><span><CheckCircle2 size={17}/> Ingresos registrados</span><strong>{count}</strong></div></div><div className="panel scanner-tips"><ShieldCheck size={22}/><h3>Verificación segura</h3><p>Los QR válidos se utilizan una sola vez. Las entradas repetidas o de otro evento son rechazadas.</p></div></aside></div>
    {result && <div className="scan-result-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setResult(null);}}><div className={`scan-result scan-${result.status}`}><button className="result-close" onClick={()=>setResult(null)}><X size={21}/></button><div className="result-icon">{result.status==='valid'?<CheckCircle2 size={51}/>:result.status==='used'?<CircleAlert size={51}/>:<XCircle size={51}/>}</div><h2>{result.status==='valid'?'¡ACCESO PERMITIDO!':result.status==='used'?'ENTRADA YA UTILIZADA':result.status==='wrong-event'?'EVENTO INCORRECTO':'QR NO VÁLIDO'}</h2><p>{result.status==='valid'?'El ingreso quedó registrado en esta demo.':result.status==='used'?'Este código ya fue escaneado anteriormente.':result.status==='wrong-event'?'La entrada pertenece a otro evento.':'No se encontró una entrada válida.'}</p>{result.ticket&&<div className="result-ticket"><span>TITULAR</span><strong>{result.ticket.holder}</strong><span>SECTOR</span><strong>{result.event?.tiers.find(t=>t.id===result.ticket?.tierId)?.name}</strong></div>}<Button onClick={()=>setResult(null)}>Continuar escaneando <ArrowRight size={17}/></Button></div></div>}</section>;
}

function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const storeRef = useRef(store);
  const [page, setPage] = useState<Page>(getPage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [previewId, setPreviewId] = useState(() => sessionStorage.getItem('mcf_demo_profile') || 'demo-admin');
  const staff = store.staff ?? demoStaff;
  const currentUser = previewId === 'guest' ? null : staff.find(member => member.id === previewId) ?? null;
  useEffect(()=>{storeRef.current=store;localStorage.setItem('mcf_tickets_demo_v1',JSON.stringify(store));},[store]);
  useEffect(()=>{const sync=()=>setPage(getPage());window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  function previewProfile(id: string) {
    setPreviewId(id);
    sessionStorage.setItem('mcf_demo_profile', id);
    const selected = id === 'guest' ? null : staff.find(member => member.id === id) ?? null;
    if (!canAccessPage(selected, page)) {
      const first = menu.find(item => canAccessPage(selected, item.id));
      const destination = first?.id ?? 'eventos';
      window.location.hash = `#/${destination}`;
      setPage(destination);
    }
    setMobileOpen(false);
  }
  const redeem=(token:string,eventId:string):ScanResult=>{
    const ticket=storeRef.current.tickets.find(t=>t.token===token);
    if(!ticket||ticket.status==='void')return {status:'invalid'};
    const event=storeRef.current.events.find(e=>e.id===ticket.eventId);
    if(ticket.eventId!==eventId)return {status:'wrong-event',ticket,event};
    if(ticket.status==='used')return {status:'used',ticket,event};
    const next={...ticket,status:'used' as const,usedAt:new Date().toISOString()};
    const updated={...storeRef.current,tickets:storeRef.current.tickets.map(t=>t.id===ticket.id?next:t)};
    storeRef.current=updated;setStore(updated);
    return {status:'valid',ticket:next,event};
  };
  const addTicket=(ticket:Ticket)=>{setStore(current=>({...current,tickets:[...current.tickets,ticket]}));};
  const pageNode = {
    admin:<AdminPage store={store} updateStore={setStore}/>,
    eventos:<ShopPage store={store} addTicket={addTicket}/>,
    publicos:<PublicPage key={currentUser?.id ?? 'guest'} store={store} user={currentUser} addTicket={addTicket}/>,
    scanner:<ScannerPage store={store} redeem={redeem}/>,
    permisos:<PermissionsPage staff={staff} events={store.events} onChange={next => setStore(current => ({...current,staff:next}))} onPreview={previewProfile}/>,
  };
  const allowed = canAccessPage(currentUser,page);
  const firstAllowed = menu.find(item => canAccessPage(currentUser,item.id));
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} open={mobileOpen} setOpen={setMobileOpen}
    user={currentUser} staff={staff} previewId={previewId} onPreview={previewProfile}/>
    <div className="main-shell"><Topbar page={page} setOpen={setMobileOpen}/>
      {allowed ? pageNode[page] : <section className="page-content access-denied"><div className="access-denied-card"><LockKeyhole size={43}/>
        <h1>Acceso restringido</h1><p>{currentUser?.active === false ? 'Este perfil todavía está pendiente de aprobación o fue suspendido.' :
          `El perfil ${currentUser ? staffRoleLabel(currentUser.role) : 'visitante'} no tiene permiso para abrir esta sección de MCF TICKETS.`}</p>
        <p className="access-denied-help">Aunque escribas el enlace directamente, la página no muestra el contenido de esa área. Esta prueba aún no sustituye la autenticación de Supabase.</p>
        {firstAllowed && <button className="btn btn-primary" onClick={() => {window.location.hash=`#/${firstAllowed.id}`;setPage(firstAllowed.id);}}>Ir a {firstAllowed.name} <ArrowRight size={16}/></button>}
      </div></section>}
      <footer className="app-footer"><span>© 2026 MCF TICKETS · Versión de desarrollo</span><span>Diseñado para experiencias inolvidables <Sparkles size={13}/></span></footer></div></div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
