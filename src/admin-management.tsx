import { useEffect, useState } from 'react';
import {
  CalendarDays, Check, CircleAlert, ClipboardList, Eye, Layers3, Pencil,
  Plus, QrCode, Search, TicketCheck, Wallet, X,
} from 'lucide-react';
import { dateLabel, formatMoney, makeId, type Batch, type CapacityChange, type EventItem, type Ticket, type Tier } from './data';

type SectorInput = { key: string; name: string; price: string; capacity: string };

const blankSector = (name = 'General'): SectorInput => ({ key: makeId(), name, price: '', capacity: '100' });
const batchLabel = (status: Batch['status']) => status === 'active' ? 'Activo' : status === 'closed' ? 'Cerrado' : 'En espera';
const batchTone = (status: Batch['status']) => status === 'active' ? 'green' : status === 'closed' ? 'neutral' : 'yellow';
const ticketSource = (source: Ticket['source']) => source === 'online' ? 'Venta online' : source === 'publico' ? 'Público' : 'Cortesía';
const ticketEmitter = (ticket: Ticket) => ticket.source === 'online' ? 'Tienda MCF' : ticket.promoter || 'Sin asignar';

const paidTotal = (tickets: Ticket[], status: Ticket['paymentStatus']) =>
  tickets.filter(t => t.status !== 'void' && t.paymentStatus === status).reduce((sum, t) => sum + t.price, 0);

export function AdminEventManager({ event, tickets, onChange, onViewTicket }: {
  event: EventItem;
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
  const [details, setDetails] = useState({ title: event.title, date: event.date, time: event.time,
    venue: event.venue, city: event.city, subtitle: event.subtitle });
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchName, setBatchName] = useState('');
  const [sectors, setSectors] = useState<SectorInput[]>([blankSector()]);
  const [formError, setFormError] = useState('');
  const [capacityTier, setCapacityTier] = useState<Tier | null>(null);
  const [additionalCapacity, setAdditionalCapacity] = useState('50');
  const [capacityReason, setCapacityReason] = useState('');
  const [capacityError, setCapacityError] = useState('');

  useEffect(() => {
    setDetails({ title: event.title, date: event.date, time: event.time,
      venue: event.venue, city: event.city, subtitle: event.subtitle });
    setEditingEvent(false);
    setSelectedBatchId('');
    setTicketBatchId('all');
    setTicketSectorId('all');
    setTicketSearch('');
    setShowBatchForm(false);
  }, [event.id]);

  const eventTickets = tickets.filter(t => t.eventId === event.id);
  const selectedBatch = event.batches.find(b => b.id === selectedBatchId) ?? event.batches[0];
  const selectedTiers = event.tiers.filter(t => t.batchId === selectedBatch?.id);
  const batchTickets = (id: string) => eventTickets.filter(t => event.tiers.find(s => s.id === t.tierId)?.batchId === id);
  const issued = (rows: Ticket[]) => rows.filter(t => t.status !== 'void').length;
  const totalCapacity = event.tiers.reduce((sum, tier) => sum + tier.capacity, 0);
  const capacityHistory = (event.capacityChanges ?? []).filter(change => change.batchId === selectedBatch?.id)
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
    onChange({ ...event, title: details.title.trim(), subtitle: details.subtitle.trim(), date: details.date,
      time: details.time, venue: details.venue.trim(), city: details.city.trim() || 'Posadas, Misiones' });
    setEditingEvent(false);
  }

  function startBatch(edit?: Batch) {
    setFormError('');
    setEditingBatchId(edit?.id ?? null);
    setBatchName(edit?.name ?? `Lote ${event.batches.length + 1}`);
    setSectors(edit ? event.tiers.filter(t => t.batchId === edit.id).map(t => ({
      key: t.id, name: t.name, price: String(t.price), capacity: String(t.capacity),
    })) : [blankSector(), blankSector('VIP')]);
    setShowBatchForm(true);
  }

  function saveBatch(e: React.FormEvent) {
    e.preventDefault();
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
      : [...event.batches, { id, name: cleanName, status: event.batches.some(b => b.status === 'active') ? 'draft' : 'active' }];
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
    setShowBatchForm(false);
  }

  function addCapacity(e: React.FormEvent) {
    e.preventDefault();
    if (!capacityTier) return;
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
    onChange({ ...event, batches: event.batches.map(b => ({ ...b,
      status: b.id === id ? status : status === 'active' && b.status === 'active' ? 'closed' : b.status,
    })) });
  }

  return <section className="adm-manager">
    <div className="adm-section-top">
      <div><span className="section-eyebrow">GESTIÓN DEL EVENTO</span><h2>{event.title}</h2>
        <p><CalendarDays size={15}/> {dateLabel(event.date)} · {event.time} hs · {event.venue}</p></div>
      <button className="btn btn-secondary" onClick={() => setEditingEvent(v => !v)}><Pencil size={15}/> {editingEvent ? 'Cerrar edición' : 'Editar evento'}</button>
    </div>

    {editingEvent && <form className="panel adm-edit-details" onSubmit={saveDetails}>
      <div className="form-stack"><div className="form-two"><label>Nombre del evento<input required value={details.title} onChange={e => setDetails({ ...details, title: e.target.value })}/></label>
        <label>Descripción corta<input value={details.subtitle} onChange={e => setDetails({ ...details, subtitle: e.target.value })}/></label></div>
        <div className="form-two"><label>Fecha<input required type="date" value={details.date} onChange={e => setDetails({ ...details, date: e.target.value })}/></label>
          <label>Hora<input required type="time" value={details.time} onChange={e => setDetails({ ...details, time: e.target.value })}/></label></div>
        <div className="form-two"><label>Lugar<input required value={details.venue} onChange={e => setDetails({ ...details, venue: e.target.value })}/></label>
          <label>Ciudad<input value={details.city} onChange={e => setDetails({ ...details, city: e.target.value })}/></label></div>
      </div><div className="adm-form-actions"><button className="btn btn-primary" type="submit"><Check size={15}/> Guardar evento</button></div>
    </form>}

    <div className="adm-finance-grid">
      <div className="adm-finance-card"><span>Online · pagos simulados</span><strong>{formatMoney(paidTotal(eventTickets, 'approved'))}</strong><small>No son cobros reales</small></div>
      <div className="adm-finance-card"><span>Ventas informadas por públicos</span><strong>{formatMoney(paidTotal(eventTickets, 'reported'))}</strong><small>Pendientes de conciliación</small></div>
      <div className="adm-finance-card"><span>Entradas emitidas</span><strong>{issued(eventTickets)}</strong><small>{eventTickets.filter(t => t.status === 'used').length} ingresos validados</small></div>
      <div className="adm-finance-card"><span>Cupos asignados a lotes</span><strong>{totalCapacity}</strong><small>{eventTickets.filter(t => t.source === 'cortesia' && t.status !== 'void').length} cortesías</small></div>
    </div>

    <div className="adm-section-top adm-lot-heading"><div><span className="section-eyebrow">PRECIOS Y DISPONIBILIDAD</span><h2>Lotes de entradas</h2>
      <p><Layers3 size={15}/> Cada lote define sus propios sectores, precios y cupos.</p></div>
      <button className="btn btn-primary" onClick={() => startBatch()}><Plus size={16}/> Nuevo lote</button></div>
    <div className="adm-batch-list">{event.batches.map(batch => {
      const rows = batchTickets(batch.id);
      const tiers = event.tiers.filter(t => t.batchId === batch.id);
      return <button key={batch.id} className={`adm-batch-card ${selectedBatch?.id === batch.id ? 'adm-batch-selected' : ''}`}
        onClick={() => { setSelectedBatchId(batch.id); setTicketBatchId(batch.id); setTicketSectorId('all'); }}>
        <span className="adm-batch-title"><strong>{batch.name}</strong><span className={`pill pill-${batchTone(batch.status)}`}>{batchLabel(batch.status)}</span></span>
        <span className="adm-batch-numbers"><b>{issued(rows)}</b> / {tiers.reduce((n, t) => n + t.capacity, 0)} entradas</span>
        <span className="adm-progress"><i style={{ width: `${Math.min(100, issued(rows) / Math.max(1, tiers.reduce((n, t) => n + t.capacity, 0)) * 100)}%` }}/></span>
        <span className="adm-batch-bottom">{tiers.length} sectores <b>{formatMoney(paidTotal(rows, 'approved') + paidTotal(rows, 'reported'))} informados</b></span>
      </button>;
    })}</div>

    {selectedBatch && <div className="panel adm-batch-detail">
      <div className="panel-title"><div><h2>{selectedBatch.name} <span className={`pill pill-${batchTone(selectedBatch.status)}`}>{batchLabel(selectedBatch.status)}</span></h2>
        <p>Desglose de entradas y recaudación por sector</p></div>
        <div className="adm-inline-actions">
          <button className="btn btn-secondary" onClick={() => startBatch(selectedBatch)}><Pencil size={14}/> Editar lote</button>
          {selectedBatch.status !== 'active' && <button className="btn btn-primary" onClick={() => setBatchStatus(selectedBatch.id, 'active')}><Check size={14}/> Activar lote</button>}
          {selectedBatch.status === 'active' && <button className="btn btn-secondary" onClick={() => setBatchStatus(selectedBatch.id, 'closed')}><X size={14}/> Cerrar lote</button>}
        </div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>SECTOR</th><th>PRECIO</th><th>EMITIDAS / CUPO</th><th>COBRADO ONLINE*</th><th>INFORMADO POR PÚBLICOS</th><th>CORTESÍAS</th><th>DISPONIBILIDAD</th></tr></thead>
        <tbody>{selectedTiers.map(tier => {
          const rows = eventTickets.filter(t => t.tierId === tier.id);
          return <tr key={tier.id}><td><strong>{tier.name}</strong></td><td>{formatMoney(tier.price)}</td>
            <td><strong>{issued(rows)}</strong> / {tier.capacity}</td><td>{formatMoney(paidTotal(rows, 'approved'))}</td>
            <td>{formatMoney(paidTotal(rows, 'reported'))}</td><td>{rows.filter(t => t.source === 'cortesia' && t.status !== 'void').length}</td>
            <td><button className="adm-open-qr" onClick={() => { setCapacityTier(tier); setAdditionalCapacity('50'); setCapacityReason(''); setCapacityError(''); }}><Plus size={14}/> Sumar entradas</button></td></tr>;
        })}</tbody></table></div>
      {capacityHistory.length > 0 && <div className="adm-capacity-history"><strong>Historial de ajustes de cupo</strong>
        {capacityHistory.slice(0, 8).map(change => <div key={change.id} className="adm-capacity-change">
          <span>{event.tiers.find(t => t.id === change.tierId)?.name ?? 'Sector'} · {change.delta > 0 ? `+${change.delta}` : change.delta} entradas</span>
          <small>{change.previous} → {change.next} · {change.actor} · {new Date(change.createdAt).toLocaleString('es-AR')}</small>
          <small>{change.reason}</small>
        </div>)}
      </div>}
      <p className="adm-helper">* En esta demo, los pagos online se simulan. Los cupos son independientes por sector y lote; se pueden ampliar aunque ya existan QR emitidos.</p>
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
        <p>Definí los sectores, precios y cupos de este lote.</p></div><button type="button" className="icon-button" onClick={() => setShowBatchForm(false)}><X size={20}/></button></div>
        <div className="form-stack"><label>Nombre del lote<input required maxLength={60} value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Ej. Earlys, Lote 1, Últimas 100"/></label></div>
        <div className="adm-sector-heading"><strong>Sectores del lote</strong><button type="button" className="adm-link-button" onClick={() => setSectors(s => [...s, blankSector('')])}><Plus size={15}/> Agregar sector</button></div>
        <div className="adm-sector-list">{sectors.map((sector, i) => <div className="adm-sector-row" key={sector.key}>
          <label>Sector {i + 1}<input required value={sector.name} placeholder="General / VIP / Ultra" onChange={e => setSectors(s => s.map(row => row.key === sector.key ? { ...row, name: e.target.value } : row))}/></label>
          <label>Precio ($)<input required type="number" min="0" step="1" value={sector.price} placeholder="15000" onChange={e => setSectors(s => s.map(row => row.key === sector.key ? { ...row, price: e.target.value } : row))}/></label>
          <label>Cupo<input required type="number" min="1" step="1" value={sector.capacity} onChange={e => setSectors(s => s.map(row => row.key === sector.key ? { ...row, capacity: e.target.value } : row))}/></label>
          <button type="button" className="adm-remove-sector" title="Quitar sector" disabled={sectors.length === 1} onClick={() => setSectors(s => s.filter(row => row.key !== sector.key))}><X size={17}/></button>
        </div>)}</div>
        {formError && <div className="form-error"><CircleAlert size={15}/>{formError}</div>}
        <div className="adm-data-note"><TicketCheck size={16}/> Podés aumentar cupos, sumar sectores y modificar precios para futuras ventas. Los importes ya registrados no cambian. Los sectores con entradas emitidas no se pueden quitar ni renombrar.</div>
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
  </section>;
}
