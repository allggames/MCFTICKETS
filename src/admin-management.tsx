import { useEffect, useState } from 'react';
import {
  CalendarDays, Check, CircleAlert, ClipboardList, Eye, Layers3, Pencil,
  Plus, QrCode, Search, TicketCheck, Wallet, X,
} from 'lucide-react';
import { batchSoldOut, dateLabel, eventPublicUrl, formatMoney, makeId, slugifyEvent, type Batch, type BatchStatusChange, type CapacityChange, type EventItem, type Ticket, type Tier } from './data';

type SectorInput = { key: string; name: string; price: string; capacity: string };

const blankSector = (name = 'General'): SectorInput => ({ key: makeId(), name, price: '', capacity: '100' });
const batchLabel = (status: Batch['status']) => status === 'sold_out' ? 'SOLD OUT' : status === 'active' ? 'Activo' : status === 'closed' ? 'Pausado' : 'En espera';
const batchTone = (status: Batch['status']) => status === 'sold_out' ? 'red' : status === 'active' ? 'green' : status === 'closed' ? 'neutral' : 'yellow';
const ticketSource = (source: Ticket['source']) => source === 'online' ? 'Venta online' : source === 'publico' ? 'Público' : 'Cortesía';
const ticketEmitter = (ticket: Ticket) => ticket.source === 'online' ? 'Tienda MCF' : ticket.promoter || 'Sin asignar';

const paidTotal = (tickets: Ticket[], status: Ticket['paymentStatus']) =>
  tickets.filter(t => t.status !== 'void' && t.paymentStatus === status).reduce((sum, t) => sum + t.price, 0);

export function AdminEventManager({ event, existingEvents, tickets, onChange, onViewTicket }: {
  event: EventItem;
  existingEvents: EventItem[];
  tickets: Ticket[];
  onChange: (next: EventItem) => void;
  onViewTicket: (ticket: Ticket) => void;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [ticketBatchId, setTicketBatchId] = useState('all');
  const [ticketSectorId, setTicketSectorId] = useState('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSourceFilter, setTicketSourceFilter] = useState('all');
  const [editingEvent, setEditingEvent] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [details, setDetails] = useState({ title: event.title, date: event.date, time: event.time,
    venue: event.venue, city: event.city, subtitle: event.subtitle, description: event.description ?? '',
    slug: event.slug ?? slugifyEvent(event.title), imageUrl: event.imageUrl ?? '' });
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchName, setBatchName] = useState('');
  const [sectors, setSectors] = useState<SectorInput[]>([blankSector()]);
  const [formError, setFormError] = useState('');
  const [capacityTier, setCapacityTier] = useState<Tier | null>(null);
  const [additionalCapacity, setAdditionalCapacity] = useState('50');
  const [capacityReason, setCapacityReason] = useState('');
  const [capacityError, setCapacityError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [pendingBatchAction, setPendingBatchAction] = useState<{ id: string; status: Batch['status'] } | null>(null);

  useEffect(() => {
    setDetails({ title: event.title, date: event.date, time: event.time,
      venue: event.venue, city: event.city, subtitle: event.subtitle, description: event.description ?? '',
      slug: event.slug ?? slugifyEvent(event.title), imageUrl: event.imageUrl ?? '' });
    setEditingEvent(false);
    setDetailsError('');
    setSelectedBatchId('');
    setTicketBatchId('all');
    setTicketSectorId('all');
    setTicketSearch('');
    setShowBatchForm(false);
    setStatusError('');
    setPendingBatchAction(null);
  }, [event.id]);

  const eventTickets = tickets.filter(t => t.eventId === event.id);
  const eventSales = eventTickets.filter(t => t.status !== 'void' && t.source !== 'cortesia' && t.paymentStatus !== 'refunded');
  const selectedBatch = event.batches.find(b => b.id === selectedBatchId) ?? event.batches[0];
  const selectedSoldOut = selectedBatch ? batchSoldOut(event, selectedBatch, eventTickets) : false;
  const activeBatch = event.batches.find(b => b.status === 'active');
  const selectedTiers = event.tiers.filter(t => t.batchId === selectedBatch?.id);
  const batchTickets = (id: string) => eventTickets.filter(t => event.tiers.find(s => s.id === t.tierId)?.batchId === id);
  const issued = (rows: Ticket[]) => rows.filter(t => t.status !== 'void').length;
  const totalCapacity = event.tiers.reduce((sum, tier) => sum + tier.capacity, 0);
  const capacityHistory = (event.capacityChanges ?? []).filter(change => change.batchId === selectedBatch?.id)
    .slice().reverse();
  const statusHistory = (event.batchStatusChanges ?? []).filter(change => change.batchId === selectedBatch?.id)
    .slice().reverse();
  const filteredTickets = eventTickets.filter(t => {
    const tier = event.tiers.find(s => s.id === t.tierId);
    const query = ticketSearch.trim().toLowerCase();
    return (ticketBatchId === 'all' || tier?.batchId === ticketBatchId) &&
      (ticketSectorId === 'all' || t.tierId === ticketSectorId) &&
      (ticketSourceFilter === 'all' || t.source === ticketSourceFilter) &&
      (!query || [t.holder, t.email, t.promoter, t.id].some(s => s.toLowerCase().includes(query)));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!details.title.trim() || !details.date || !details.time || !details.venue.trim()) return;
    const slug = slugifyEvent(details.slug);
    if (!slug) { setDetailsError('Ingresá una URL de evento válida.'); return; }
    if (existingEvents.some(item => item.id !== event.id && (item.slug || slugifyEvent(item.title)) === slug)) {
      setDetailsError('Esa URL ya está asignada a otro evento.'); return;
    }
    setDetailsError('');
    onChange({ ...event, title: details.title.trim(), subtitle: details.subtitle.trim(),
      description: details.description.trim(), slug, imageUrl: details.imageUrl.trim(), date: details.date,
      time: details.time, venue: details.venue.trim(), city: details.city.trim() || 'Posadas, Misiones' });
    setEditingEvent(false);
  }

  function startBatch(edit?: Batch) {
    if (edit && batchSoldOut(event, edit, eventTickets)) {
      setStatusError('Este lote quedó SOLD OUT. No se pueden modificar sectores, precios ni cupos.'); return;
    }
    setFormError('');
    setEditingBatchId(edit?.id ?? null);
    setBatchName(edit?.name ?? `Lote ${event.batches.length + 1}`);
    setSectors(edit ? event.tiers.filter(t => t.batchId === edit.id).map(t => ({
      key: t.id, name: t.name, price: String(t.price), capacity: String(t.capacity),
    })) : [blankSector()]);
    setShowBatchForm(true);
  }

  function saveBatch(e: React.FormEvent) {
    e.preventDefault();
    const current = event.batches.find(batch => batch.id === editingBatchId);
    if (current && batchSoldOut(event, current, eventTickets)) {
      setFormError('No se puede editar un lote después de SOLD OUT.'); return;
    }
    const cleanName = batchName.trim();
    if (!cleanName || event.batches.some(b => b.id !== editingBatchId && b.name.toLowerCase() === cleanName.toLowerCase())) {
      setFormError('Ese nombre de lote está vacío o ya existe.'); return;
    }
    const names = sectors.map(s => s.name.trim().toLowerCase());
    if (!sectors.length || names.some(n => !n) || new Set(names).size !== names.length ||
      sectors.some(s => s.price.trim() === '' || !Number.isFinite(Number(s.price)) || Number(s.price) < 0 ||
        !Number.isInteger(Number(s.capacity)) || Number(s.capacity) < 1)) {
      setFormError('Revisá los sectores: nombres únicos, precios desde $0 y cupos enteros mayores a 0.'); return;
    }
    const id = editingBatchId ?? makeId();
    const previousTiers = event.tiers.filter(t => t.batchId === id);
    for (const old of previousTiers) {
      const existingSold = issued(eventTickets.filter(t => t.tierId === old.id));
      const next = sectors.find(s => s.key === old.id);
      if (existingSold && (!next || next.name.trim() !== old.name)) {
        setFormError(`El sector ${old.name} ya tiene entradas emitidas: no podés quitarlo ni renombrarlo.`); return;
      }
      if (next && Number(next.capacity) < existingSold) {
        setFormError(`El cupo de ${old.name} no puede ser menor a ${existingSold} entradas emitidas.`); return;
      }
    }
    const newTiers: Tier[] = sectors.map(s => ({
      id: editingBatchId ? s.key : makeId(), batchId: id,
      name: s.name.trim(), price: Math.round(Number(s.price)), capacity: Number(s.capacity),
    }));
    const nextBatches: Batch[] = editingBatchId
      ? event.batches.map(b => b.id === id ? { ...b, name: cleanName } : b)
      : [...event.batches, { id, name: cleanName, status: 'draft' }];
    const now = new Date().toISOString();
    const edits: CapacityChange[] = previousTiers.flatMap(old => {
      const next = newTiers.find(t => t.id === old.id);
      if (!next || next.capacity === old.capacity) return [];
      return [{ id: makeId(), batchId: id, tierId: old.id, previous: old.capacity,
        next: next.capacity, delta: next.capacity - old.capacity, reason: 'Edición de lote',
        actor: 'Administrador (demo)', createdAt: now }];
    });
    onChange({ ...event, batches: nextBatches,
      tiers: [...event.tiers.filter(t => t.batchId !== id), ...newTiers],
      capacityChanges: [...(event.capacityChanges ?? []), ...edits] });
    setSelectedBatchId(id);
    setStatusError('');
    setShowBatchForm(false);
  }

  function addCapacity(e: React.FormEvent) {
    e.preventDefault();
    if (!capacityTier) return;
    const batch = event.batches.find(row => row.id === capacityTier.batchId);
    if (!batch || batchSoldOut(event, batch, eventTickets)) {
      setCapacityError('No se pueden agregar ingresos después de SOLD OUT.'); return;
    }
    const extra = Number(additionalCapacity);
    const next = capacityTier.capacity + extra;
    if (!Number.isSafeInteger(extra) || extra <= 0 || !Number.isSafeInteger(next)) {
      setCapacityError('Ingresá una cantidad entera de entradas mayor a cero.'); return;
    }
    const change: CapacityChange = { id: makeId(), batchId: capacityTier.batchId, tierId: capacityTier.id,
      previous: capacityTier.capacity, next, delta: extra,
      reason: capacityReason.trim() || 'Ampliación de cupo', actor: 'Administrador (demo)',
      createdAt: new Date().toISOString() };
    onChange({ ...event, tiers: event.tiers.map(t => t.id === capacityTier.id ? { ...t, capacity: next } : t),
      capacityChanges: [...(event.capacityChanges ?? []), change] });
    setCapacityTier(null);
    setAdditionalCapacity('50'); setCapacityReason(''); setCapacityError('');
  }

  function setBatchStatus(id: string, status: Batch['status']) {
    const batch = event.batches.find(b => b.id === id);
    if (!batch || batch.status === status) return;
    if (status === 'active' && event.status === 'closed') {
      setStatusError('El evento está cerrado: no podés reactivar ventas de ningún lote.'); return;
    }
    if (batch.status === 'sold_out' || (status === 'active' && batchSoldOut(event, batch, eventTickets))) {
      setStatusError('SOLD OUT es definitivo: no se puede reabrir ni ampliar el lote.'); return;
    }
    if (status === 'active' && activeBatch && activeBatch.id !== id) {
      setStatusError(`Primero cerrá ${activeBatch.name}. Los lotes no se cambian automáticamente.`);
      return;
    }
    if (status === 'active' && !event.tiers.some(t => t.batchId === id)) {
      setStatusError('Agregá por lo menos un sector antes de abrir las ventas de este lote.');
      return;
    }
    const change: BatchStatusChange = { id: makeId(), batchId: id, previous: batch.status,
      next: status, actor: 'Administrador (demo)', createdAt: new Date().toISOString() };
    setStatusError('');
    onChange({ ...event, batches: event.batches.map(b => b.id === id ? { ...b, status } : b),
      batchStatusChanges: [...(event.batchStatusChanges ?? []), change] });
  }

  return <section className="adm-manager">
    <div className="adm-section-top">
      <div><span className="section-eyebrow">GESTIÓN DEL EVENTO</span><h2>{event.title}</h2>
        <p><CalendarDays size={15}/> {dateLabel(event.date)} · {event.time} hs · {event.venue} · {event.status === 'closed' ? 'EVENTO CERRADO' : event.status === 'draft' ? 'BORRADOR' : 'PUBLICADO'}</p></div>
      <button className="btn btn-secondary" onClick={() => setEditingEvent(v => !v)}><Pencil size={15}/> {editingEvent ? 'Cerrar edición' : 'Editar evento'}</button>
    </div>

    {event.status === 'closed' && <div className="adm-event-closed-note"><CircleAlert size={19}/><strong>Evento cerrado.</strong> Las ventas online y por RR. PP. están detenidas para todos los lotes. El historial y los QR emitidos siguen disponibles.</div>}

    {editingEvent && <form className="panel adm-edit-details" onSubmit={saveDetails}>
      <div className="form-stack"><div className="form-two"><label>Nombre del evento<input required value={details.title} onChange={e => setDetails({ ...details, title: e.target.value })}/></label>
        <label>Descripción corta<input value={details.subtitle} onChange={e => setDetails({ ...details, subtitle: e.target.value })}/></label></div>
        <div className="form-two"><label>Fecha<input required type="date" value={details.date} onChange={e => setDetails({ ...details, date: e.target.value })}/></label>
          <label>Hora<input required type="time" value={details.time} onChange={e => setDetails({ ...details, time: e.target.value })}/></label></div>
        <label>Descripción del evento (opcional)<textarea rows={3} maxLength={1000} value={details.description} onChange={e => setDetails({ ...details, description: e.target.value })}/></label>
        <div className="form-two"><label>Lugar<input required value={details.venue} onChange={e => setDetails({ ...details, venue: e.target.value })}/></label>
          <label>Ciudad<input value={details.city} onChange={e => setDetails({ ...details, city: e.target.value })}/></label></div>
        <div className="form-two"><label>URL personalizada<input value={details.slug} onChange={e => setDetails({ ...details, slug: e.target.value })} placeholder="nombre-del-evento"/></label>
          <label>URL de imagen (opcional)<input type="url" value={details.imageUrl.startsWith('data:') ? '' : details.imageUrl} onChange={e => setDetails({ ...details, imageUrl: e.target.value })} placeholder="https://..."/></label></div>
        <p className="adm-helper">Enlace público: {eventPublicUrl({ ...event, slug: slugifyEvent(details.slug) })}</p>
      </div>{detailsError && <p className="form-error"><CircleAlert size={15}/>{detailsError}</p>}<div className="adm-form-actions"><button className="btn btn-primary" type="submit"><Check size={15}/> Guardar evento</button></div>
    </form>}

    <div className="adm-finance-grid">
      <div className="adm-finance-card"><span>Tickets vendidos · evento</span><strong>{eventSales.length}</strong><small>{issued(eventTickets)} QR emitidos incluyendo cortesías</small></div>
      <div className="adm-finance-card"><span>Ingresos registrados · evento*</span><strong>{formatMoney(eventSales.reduce((sum, t) => sum + t.price, 0))}</strong><small>Recaudación bruta informada, no ganancia neta</small></div>
      <div className="adm-finance-card"><span>Ventas online simuladas</span><strong>{formatMoney(paidTotal(eventTickets, 'approved'))}</strong><small>No son cobros reales</small></div>
      <div className="adm-finance-card"><span>Ventas de RR. PP.</span><strong>{formatMoney(paidTotal(eventTickets, 'reported'))}</strong><small>Informadas, sin conciliar · {totalCapacity} cupos totales</small></div>
    </div>

    <div className="adm-section-top adm-lot-heading"><div><span className="section-eyebrow">PRECIOS Y DISPONIBILIDAD</span><h2>Lotes de entradas</h2>
      <p><Layers3 size={15}/> Cada lote define sus propios sectores, precios y cupos.</p></div>
      <button className="btn btn-primary" onClick={() => startBatch()}><Plus size={16}/> Nuevo lote</button></div>
    <div className="adm-manual-status"><span className="adm-manual-icon"><Check size={18}/></span><div>
      <strong>Control manual de lotes</strong>
      <p>{activeBatch ? <>Venta habilitada: <b>{activeBatch.name}</b>. Para pasar a otro lote, cerrá este y abrí el siguiente.</>
        : <>Ventas sin lote habilitado. Abrí el lote que quieras desde su panel cuando estés lista.</>}
        {' '}Un lote agotado nunca activa automáticamente al siguiente.</p>
    </div></div>
    <div className="adm-batch-list">{event.batches.map(batch => {
      const rows = batchTickets(batch.id);
      const tiers = event.tiers.filter(t => t.batchId === batch.id);
      const available = tiers.reduce((n, tier) => n + Math.max(0, tier.capacity - issued(eventTickets.filter(t => t.tierId === tier.id))), 0);
      const soldOut = batchSoldOut(event, batch, eventTickets);
      return <button key={batch.id} className={`adm-batch-card ${selectedBatch?.id === batch.id ? 'adm-batch-selected' : ''}`}
        onClick={() => { setSelectedBatchId(batch.id); setTicketBatchId(batch.id); setTicketSectorId('all'); setStatusError(''); }}>
        <span className="adm-batch-title"><strong>{batch.name}</strong><span className={`pill pill-${soldOut ? 'red' : batchTone(batch.status)}`}>{soldOut ? 'SOLD OUT' : batchLabel(batch.status)}</span></span>
        <span className="adm-batch-numbers"><b>{issued(rows)}</b> / {tiers.reduce((n, t) => n + t.capacity, 0)} entradas</span>
        <span className="adm-progress"><i style={{ width: `${Math.min(100, issued(rows) / Math.max(1, tiers.reduce((n, t) => n + t.capacity, 0)) * 100)}%` }}/></span>
        <span className="adm-batch-bottom">{tiers.length} sectores · {soldOut ? 'Ventas finalizadas' : `${available} disponibles`} <b>{formatMoney(paidTotal(rows, 'approved') + paidTotal(rows, 'reported'))} informados</b></span>
      </button>;
    })}</div>

    {selectedBatch && <div className="panel adm-batch-detail">
      <div className="panel-title"><div><h2>{selectedBatch.name} <span className={`pill pill-${selectedSoldOut ? 'red' : batchTone(selectedBatch.status)}`}>{selectedSoldOut ? 'SOLD OUT' : batchLabel(selectedBatch.status)}</span></h2>
        <p>Desglose de entradas y recaudación por sector</p></div>
        <div className="adm-inline-actions">
          <button className="btn btn-secondary" disabled={selectedSoldOut} onClick={() => startBatch(selectedBatch)}><Pencil size={14}/> Editar lote</button>
          {!selectedSoldOut && selectedBatch.status !== 'active' && <button className="btn btn-primary" disabled={event.status === 'closed' || (!!activeBatch && activeBatch.id !== selectedBatch.id)}
            title={activeBatch ? `Primero cerrá ${activeBatch.name}` : 'Habilitar ventas de este lote'}
            onClick={() => setPendingBatchAction({ id: selectedBatch.id, status: 'active' })}><Check size={14}/> Abrir ventas</button>}
          {!selectedSoldOut && selectedBatch.status === 'active' && <button className="btn btn-secondary" onClick={() => setPendingBatchAction({ id: selectedBatch.id, status: 'closed' })}><X size={14}/> Pausar ventas</button>}
          {selectedBatch.status !== 'sold_out' && <button className="btn btn-soldout" onClick={() => setPendingBatchAction({ id: selectedBatch.id, status: 'sold_out' })}><X size={14}/> Forzar SOLD OUT</button>}
        </div></div>
      {selectedBatch.status !== 'active' && activeBatch && <p className="adm-manual-hint">Para abrir {selectedBatch.name}, primero cerrá las ventas de {activeBatch.name}. Esto no sucederá automáticamente.</p>}
      {statusError && <p className="form-error"><CircleAlert size={15}/>{statusError}</p>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>SECTOR</th><th>PRECIO</th><th>EMITIDAS / CUPO</th><th>COBRADO ONLINE*</th><th>INFORMADO POR PÚBLICOS</th><th>CORTESÍAS</th><th>DISPONIBILIDAD</th></tr></thead>
        <tbody>{selectedTiers.map(tier => {
          const rows = eventTickets.filter(t => t.tierId === tier.id);
          return <tr key={tier.id}><td><strong>{tier.name}</strong></td><td>{formatMoney(tier.price)}</td>
            <td><strong>{issued(rows)}</strong> / {tier.capacity}</td><td>{formatMoney(paidTotal(rows, 'approved'))}</td>
            <td>{formatMoney(paidTotal(rows, 'reported'))}</td><td>{rows.filter(t => t.source === 'cortesia' && t.status !== 'void').length}</td>
            <td>{selectedSoldOut ? <span className="adm-soldout-lock">SOLD OUT · Bloqueado</span>
              : <button className="adm-open-qr" onClick={() => { setCapacityTier(tier); setAdditionalCapacity('50'); setCapacityReason(''); setCapacityError(''); }}><Plus size={14}/> Sumar entradas</button>}</td></tr>;
        })}</tbody></table></div>
      {capacityHistory.length > 0 && <div className="adm-capacity-history"><strong>Historial de ajustes de cupo</strong>
        {capacityHistory.slice(0, 8).map(change => <div key={change.id} className="adm-capacity-change">
          <span>{event.tiers.find(t => t.id === change.tierId)?.name ?? 'Sector'} · {change.delta > 0 ? `+${change.delta}` : change.delta} entradas</span>
          <small>{change.previous} → {change.next} · {change.actor} · {new Date(change.createdAt).toLocaleString('es-AR')}</small>
          <small>{change.reason}</small>
        </div>)}
      </div>}
      {statusHistory.length > 0 && <div className="adm-capacity-history"><strong>Historial de apertura y cierre</strong>
        {statusHistory.slice(0, 8).map(change => <div key={change.id} className="adm-capacity-change">
          <span>{batchLabel(change.previous)} → {batchLabel(change.next)}</span>
          <small>{change.actor} · {new Date(change.createdAt).toLocaleString('es-AR')}</small>
        </div>)}
      </div>}
      <p className="adm-helper">* En esta demo, los pagos online se simulan. Cada sector tiene cupo y precio propio. Solo el administrador puede ampliar ingresos, y nunca después de SOLD OUT.</p>
    </div>}

    <div className="panel adm-qr-panel"><div className="panel-title"><div><h2><QrCode size={19}/> Control de QR emitidos</h2>
      <p>Consultá el titular, lote, sector, emisor y estado de cada entrada.</p></div><span className="tiny-pill"><ClipboardList size={13}/> {filteredTickets.length} registros</span></div>
      <div className="adm-filters"><label className="search-box"><Search size={16}/><input placeholder="Buscar titular, email, emisor o código" value={ticketSearch} onChange={e => setTicketSearch(e.target.value)}/></label>
        <select aria-label="Filtrar por lote" value={ticketBatchId} onChange={e => { setTicketBatchId(e.target.value); setTicketSectorId('all'); }}>
          <option value="all">Todos los lotes</option>{event.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select aria-label="Filtrar por sector" value={ticketSectorId} onChange={e => setTicketSectorId(e.target.value)}>
          <option value="all">Todos los sectores</option>{event.tiers.filter(t => ticketBatchId === 'all' || t.batchId === ticketBatchId).map(t =>
            <option key={t.id} value={t.id}>{event.batches.find(b => b.id === t.batchId)?.name} · {t.name}</option>)}</select>
        <select aria-label="Filtrar por origen" value={ticketSourceFilter} onChange={e => setTicketSourceFilter(e.target.value)}>
          <option value="all">Todos los orígenes</option><option value="online">Online</option><option value="publico">Públicos</option><option value="cortesia">Cortesías</option>
        </select></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>TITULAR / DESTINO</th><th>LOTE · SECTOR</th><th>GENERADO POR</th><th>TIPO / IMPORTE</th><th>ESTADO</th><th>QR</th></tr></thead><tbody>
        {filteredTickets.map(ticket => {
          const tier = event.tiers.find(t => t.id === ticket.tierId);
          const batch = event.batches.find(b => b.id === tier?.batchId);
          return <tr key={ticket.id}><td><strong>{ticket.holder}</strong><small className="table-secondary">{ticket.email}</small></td>
            <td><strong>{batch?.name ?? '—'}</strong><small className="table-secondary">{tier?.name ?? '—'}</small></td>
            <td><strong>{ticketEmitter(ticket)}</strong><small className="table-secondary">{new Date(ticket.createdAt).toLocaleString('es-AR')}</small></td>
            <td><strong>{ticketSource(ticket.source)}</strong><small className="table-secondary">{formatMoney(ticket.price)}</small></td>
            <td><span className={`pill pill-${ticket.status === 'valid' ? 'green' : ticket.status === 'used' ? 'yellow' : 'red'}`}>{ticket.status === 'valid' ? 'Disponible' : ticket.status === 'used' ? 'Utilizado' : 'Anulado'}</span></td>
            <td><button className="adm-open-qr" onClick={() => onViewTicket(ticket)} aria-label={`Ver QR de ${ticket.holder}`} title="Ver y descargar QR"><Eye size={16}/> Ver QR</button></td></tr>;
        })}
        {!filteredTickets.length && <tr><td colSpan={6} className="adm-empty">No hay entradas con estos filtros.</td></tr>}
      </tbody></table></div>
      <div className="adm-data-note"><CircleAlert size={15}/><span>La demo permite abrir los QR generados, pero no envía correos. Más adelante agregaremos fecha de envío, estado de entrega y reenvío auditado.</span></div>
    </div>

    {showBatchForm && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setShowBatchForm(false); }}>
      <form className="modal-card adm-batch-modal" onSubmit={saveBatch}><div className="modal-header"><div><h2>{editingBatchId ? 'Editar lote' : 'Crear nuevo lote'}</h2>
        <p>Definí el nombre del lote y al menos un sector. Los demás son opcionales.</p></div><button type="button" className="icon-button" onClick={() => setShowBatchForm(false)}><X size={20}/></button></div>
        <div className="form-stack"><label>Nombre del lote<input required maxLength={60} value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Ej. Earlys, Lote 1, Últimas 100"/></label></div>
        <div className="adm-sector-heading"><strong>Sectores del lote · {sectors.length}</strong><button type="button" className="adm-link-button" onClick={() => setSectors(s => [...s, blankSector('')])}><Plus size={15}/> Agregar otro sector</button></div>
        <div className="adm-sector-list">{sectors.map((sector, i) => <div className="adm-sector-row" key={sector.key}>
          <label>Sector {i + 1}<input required value={sector.name} placeholder="General / VIP / Ultra" onChange={e => setSectors(s => s.map(row => row.key === sector.key ? { ...row, name: e.target.value } : row))}/></label>
          <label>Precio ($)<input required type="number" min="0" step="1" value={sector.price} placeholder="15000" onChange={e => setSectors(s => s.map(row => row.key === sector.key ? { ...row, price: e.target.value } : row))}/></label>
          <label>Cupo<input required type="number" min="1" step="1" value={sector.capacity} onChange={e => setSectors(s => s.map(row => row.key === sector.key ? { ...row, capacity: e.target.value } : row))}/></label>
          <button type="button" className="adm-remove-sector" title={sectors.length === 1 ? 'Debe quedar al menos un sector' : `Quitar ${sector.name || 'sector'}`} aria-label={`Quitar sector ${i + 1}`} disabled={sectors.length === 1} onClick={() => setSectors(s => s.filter(row => row.key !== sector.key))}><X size={17}/></button>
        </div>)}</div>
        {formError && <div className="form-error"><CircleAlert size={15}/>{formError}</div>}
        <div className="adm-data-note"><TicketCheck size={16}/> Este lote se crea en espera: solo el administrador puede habilitarlo. Podés aumentar cupos, sumar sectores y modificar precios para futuras ventas. Los sectores con entradas emitidas no se pueden quitar ni renombrar.</div>
        <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowBatchForm(false)}>Cancelar</button>
          <button type="submit" className="btn btn-primary"><Wallet size={16}/> {editingBatchId ? 'Guardar cambios' : 'Crear lote'}</button></div>
      </form>
    </div>}
    {capacityTier && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setCapacityTier(null); }}>
      <form className="modal-card adm-capacity-modal" onSubmit={addCapacity}>
        <div className="modal-header"><div><h2>Sumar entradas disponibles</h2>
          <p>{selectedBatch?.name} · {capacityTier.name} · {formatMoney(capacityTier.price)}</p></div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setCapacityTier(null)}><X size={19}/></button></div>
        <div className="adm-capacity-preview"><div><small>Cupo actual</small><strong>{capacityTier.capacity}</strong></div>
          <div><small>Ya emitidas</small><strong>{issued(eventTickets.filter(t => t.tierId === capacityTier.id))}</strong></div>
          <div><small>Nuevo cupo</small><strong>{Number.isSafeInteger(Number(additionalCapacity)) && Number(additionalCapacity) > 0 ? capacityTier.capacity + Number(additionalCapacity) : '—'}</strong></div></div>
        <div className="form-stack"><label>¿Cuántas entradas querés agregar?<input type="number" min="1" step="1" required value={additionalCapacity} onChange={e => setAdditionalCapacity(e.target.value)}/></label>
          <label>Motivo del ajuste (opcional)<input maxLength={180} placeholder="Ej. Se habilitaron 50 lugares más" value={capacityReason} onChange={e => setCapacityReason(e.target.value)}/></label></div>
        {capacityError && <p className="form-error"><CircleAlert size={15}/>{capacityError}</p>}
        <p className="adm-helper">Esta acción mantiene intactos todos los QR y entradas ya emitidos.</p>
        <div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={() => setCapacityTier(null)}>Cancelar</button>
          <button className="btn btn-primary" type="submit"><Plus size={16}/> Confirmar ampliación</button></div>
      </form>
    </div>}
    {pendingBatchAction && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setPendingBatchAction(null); }}>
      <div className="modal-card adm-manual-confirm" role="dialog" aria-modal="true" aria-labelledby="adm-manual-confirm-title">
        <div className="modal-header"><div><h2 id="adm-manual-confirm-title">{pendingBatchAction.status === 'active' ? '¿Abrir ventas de este lote?' : pendingBatchAction.status === 'sold_out' ? '¿Finalizar este lote como SOLD OUT?' : '¿Pausar ventas de este lote?'}</h2>
          <p>{event.batches.find(b => b.id === pendingBatchAction.id)?.name}</p></div>
          <button className="icon-button" aria-label="Cerrar" onClick={() => setPendingBatchAction(null)}><X size={18}/></button></div>
        <p className="adm-manual-description">{pendingBatchAction.status === 'active'
          ? 'Este lote quedará disponible para la venta online y la emisión de los públicos. Ningún otro lote se activará automáticamente.'
          : pendingBatchAction.status === 'sold_out'
          ? 'SOLD OUT afecta solamente a este lote. Es definitivo: no podrás reabrirlo, modificar sus sectores ni sumar entradas, aunque queden cupos. Los QR emitidos continúan válidos. Los demás lotes no se modifican.'
          : 'Se pausarán las ventas de este lote. Podrás reabrirlo manualmente si no llegó a SOLD OUT. No se abrirá otro lote automáticamente.'}</p>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setPendingBatchAction(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { setBatchStatus(pendingBatchAction.id, pendingBatchAction.status); setPendingBatchAction(null); }}>
            {pendingBatchAction.status === 'active' ? 'Sí, abrir ventas' : pendingBatchAction.status === 'sold_out' ? 'Confirmar SOLD OUT del lote' : 'Sí, pausar ventas'}</button></div>
      </div>
    </div>}
  </section>;
}
