import { useState } from 'react';
import { CalendarDays, CircleAlert, Copy, ImagePlus, Layers3, Plus, Save, TicketCheck, X } from 'lucide-react';
import { eventPublicUrl, eventTimeRangeValid, makeId, slugifyEvent, type EventItem, type Tier } from './data';

type SectorForm = { id: string; name: string; price: string; capacity: string };
type BatchForm = { id: string; name: string; sectors: SectorForm[] };
const newSector = (name = ''): SectorForm => ({ id: makeId(), name, price: '15000', capacity: '100' });
const newBatch = (i: number): BatchForm => ({ id: makeId(), name: `Lote ${i}`, sectors: [newSector('General')] });

export function EventCreateForm({ existing, onCreate }: {
  existing: EventItem[];
  onCreate: (event: EventItem) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('23:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('05:00');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('Posadas, Misiones');
  const [slugInput, setSlugInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [batches, setBatches] = useState<BatchForm[]>([newBatch(1)]);
  const [error, setError] = useState('');
  const slug = slugifyEvent(slugInput.trim() || title);
  const url = eventPublicUrl({ slug, id: 'evento', title: '', subtitle: '', date: '', time: '', venue: '', city: '', status: 'draft', accent: '', batches: [], tiers: [] });

  function updateBatch(id: string, edit: (batch: BatchForm) => BatchForm) {
    setBatches(rows => rows.map(row => row.id === id ? edit(row) : row));
  }

  function setSector(batchId: string, sectorId: string, patch: Partial<SectorForm>) {
    updateBatch(batchId, batch => ({ ...batch, sectors: batch.sectors.map(sector => sector.id === sectorId ? { ...sector, ...patch } : sector) }));
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 900_000) {
      setError('La imagen debe ser JPG, PNG o WEBP y pesar menos de 900 KB en esta demostración.'); return;
    }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') { setImageUrl(reader.result); setError(''); } };
    reader.onerror = () => setError('No pudimos leer la imagen. Intentá con otra.');
    reader.readAsDataURL(file);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time || !endDate || !endTime || !venue.trim() || !slug) {
      setError('Completá nombre, inicio, fin, lugar y URL del evento.'); return;
    }
    if (!eventTimeRangeValid(date, time, endDate, endTime)) {
      setError('La fecha y hora de fin deben ser posteriores al inicio del evento.'); return;
    }
    if (existing.some(event => (event.slug || slugifyEvent(event.title)) === slug)) {
      setError('La URL del evento ya está ocupada. Elegí otra.'); return;
    }
    if (!batches.length || batches.some(batch => !batch.name.trim() || !batch.sectors.length ||
      new Set(batch.sectors.map(s => s.name.trim().toLowerCase())).size !== batch.sectors.length ||
      batch.sectors.some(sector => !sector.name.trim() || sector.price.trim() === '' ||
        !Number.isSafeInteger(Number(sector.price)) || Number(sector.price) < 0 ||
        !Number.isSafeInteger(Number(sector.capacity)) || Number(sector.capacity) < 1)) ||
      new Set(batches.map(b => b.name.trim().toLowerCase())).size !== batches.length) {
      setError('Revisá lotes y sectores: nombres únicos, precios válidos y cupos enteros mayores a cero.'); return;
    }
    const tiers: Tier[] = batches.flatMap(batch => batch.sectors.map(sector => ({
      id: makeId(), batchId: batch.id, name: sector.name.trim(), price: Number(sector.price), capacity: Number(sector.capacity),
    })));
    onCreate({ id: makeId(), title: title.trim().toUpperCase(), subtitle: description.trim() || 'Evento MCF TICKETS',
      description: description.trim(), date, time, endDate, endTime, venue: venue.trim(), city: city.trim() || 'Posadas, Misiones',
      imageUrl, slug, status: 'draft', accent: '#9774ec',
      batches: batches.map(batch => ({ id: batch.id, name: batch.name.trim(), status: 'draft' as const })),
      tiers, capacityChanges: [], batchStatusChanges: [] });
  }

  return <form className="event-create-form" onSubmit={save}>
    <div className="panel event-create-section">
      <div className="event-create-step"><span>01</span><div><h2>Información del evento</h2><p>Los datos que se mostrarán al público.</p></div></div>
      <div className="form-stack">
        <label>Nombre del evento *<input required maxLength={120} placeholder="Ej. CLUB DEL FUNK" value={title} onChange={e => setTitle(e.target.value)}/></label>
        <label>Descripción (opcional)<textarea rows={3} maxLength={1000} placeholder="Contá de qué se trata el evento" value={description} onChange={e => setDescription(e.target.value)}/></label>
        <div className="event-period-label">INICIO DEL EVENTO</div>
        <div className="form-two"><label>Fecha de inicio *<input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
          <label>Hora de inicio *<input type="time" required value={time} onChange={e => setTime(e.target.value)}/></label></div>
        <div className="event-period-label">FINALIZACIÓN DEL EVENTO</div>
        <div className="form-two"><label>Fecha de fin *<input type="date" required value={endDate} min={date || undefined} onChange={e => setEndDate(e.target.value)}/></label>
          <label>Hora de fin *<input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}/></label></div>
        <p className="event-period-note"><CircleAlert size={15}/> Al llegar la fecha y hora de fin (horario de Argentina), el evento pasará automáticamente a <strong>Evento pasado</strong> y dejará de admitir ventas y emisiones. Podés elegir el día siguiente si la fiesta termina de madrugada.</p>
        <div className="form-two"><label>Lugar *<input required placeholder="Nombre del lugar" value={venue} onChange={e => setVenue(e.target.value)}/></label>
          <label>Ciudad<input value={city} onChange={e => setCity(e.target.value)}/></label></div>
      </div>
      <div className="event-media-grid"><div><label className="event-image-picker"><ImagePlus size={25}/><strong>Imagen del evento</strong>
        <span>Subí JPG, PNG o WEBP · máximo 900 KB</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Subir imagen del evento" onChange={e => chooseImage(e.target.files?.[0])}/>
      </label><p className="event-create-note">En esta demo queda guardada solo en este navegador. Más adelante usaremos Supabase Storage.</p></div>
        <div className="event-image-preview">{imageUrl ? <img src={imageUrl} alt="Vista previa de la imagen del evento"/> : <><ImagePlus size={30}/><span>Vista previa de la imagen</span></>}</div></div>
      <div className="event-url-field"><label>URL del evento *<span className="event-url-prefix">https://allggames.github.io/MCFTICKETS/#/eventos/</span>
        <input value={slugInput} onChange={e => setSlugInput(e.target.value)} placeholder={slugifyEvent(title) || 'nombre-del-evento'}/></label>
        <button className="btn btn-secondary" type="button" disabled={!slug} onClick={() => navigator.clipboard?.writeText(url)}><Copy size={15}/> Copiar enlace</button>
        <small>Enlace previsto: {url}. Funcionará para compradores cuando publiques el evento.</small></div>
    </div>

    <div className="panel event-create-section">
      <div className="event-create-step"><span>02</span><div><h2>Dividir por lotes</h2><p>Cada lote puede tener uno o varios sectores, con precio y cupo independientes.</p></div></div>
      <div className="event-batch-form-list">{batches.map((batch, i) => <div className="event-batch-form" key={batch.id}>
        <div className="event-batch-form-head"><Layers3 size={18}/><strong>Lote {i + 1}</strong>
          <button type="button" aria-label={`Eliminar lote ${i + 1}`} disabled={batches.length === 1} onClick={() => setBatches(rows => rows.filter(row => row.id !== batch.id))}><X size={17}/></button></div>
        <label>Nombre del lote<input required value={batch.name} onChange={e => updateBatch(batch.id, row => ({ ...row, name: e.target.value }))} placeholder="Earlys, Lote 1, Lote 2..."/></label>
        <div className="event-batch-sector-heading"><strong>Sectores de este lote</strong><button type="button" onClick={() => updateBatch(batch.id, row => ({ ...row, sectors: [...row.sectors, newSector()] }))}><Plus size={15}/> Agregar sector</button></div>
        <div className="event-batch-sector-list">{batch.sectors.map((sector, index) => <div className="event-batch-sector" key={sector.id}>
          <label>Sector {index + 1}<input required placeholder="General / VIP / Ultra" value={sector.name} onChange={e => setSector(batch.id, sector.id, { name: e.target.value })}/></label>
          <label>Precio ($)<input required type="number" min="0" step="1" value={sector.price} onChange={e => setSector(batch.id, sector.id, { price: e.target.value })}/></label>
          <label>Nº de ingresos<input required type="number" min="1" step="1" value={sector.capacity} onChange={e => setSector(batch.id, sector.id, { capacity: e.target.value })}/></label>
          <button type="button" aria-label={`Quitar sector ${index + 1}`} disabled={batch.sectors.length === 1} onClick={() => updateBatch(batch.id, row => ({ ...row, sectors: row.sectors.filter(s => s.id !== sector.id) }))}><X size={17}/></button>
        </div>)}</div>
      </div>)}</div>
      <button type="button" className="btn btn-secondary event-add-batch" onClick={() => setBatches(rows => [...rows, newBatch(rows.length + 1)])}><Plus size={17}/> Agregar otro lote</button>
      <div className="event-rule-note"><TicketCheck size={19}/><span>Los lotes se crean <strong>en espera</strong>. Solo el administrador abre cada lote manualmente. Puede forzar SOLD OUT por lote aunque queden ingresos; desde SOLD OUT no podrá reabrirlo ni aumentar sus cupos.</span></div>
    </div>
    {error && <div className="form-error event-create-error"><CircleAlert size={17}/>{error}</div>}
    <div className="event-create-submit"><span><CalendarDays size={17}/> El evento se guardará como borrador, sin ventas habilitadas.</span>
      <button className="btn btn-primary" type="submit"><Save size={17}/> Crear evento</button></div>
  </form>;
}
