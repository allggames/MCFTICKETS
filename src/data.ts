export type Batch = { id: string; name: string; status: 'draft' | 'active' | 'closed' | 'sold_out' };
export type StaffRole = 'admin' | 'promoter';
export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  // Lista de eventos habilitados expresamente para este RR. PP.
  // Un admin tiene acceso global, independiente de esta lista.
  allowedEventIds: string[];
  // Permiso adicional para emitir invitaciones/cortesías sin cargo, por evento.
  // Nunca se concede implícitamente con la habilitación de venta.
  invitationEventIds: string[];
};
export type BatchStatusChange = {
  id: string;
  batchId: string;
  previous: Batch['status'];
  next: Batch['status'];
  actor: string;
  createdAt: string;
};
export type Tier = { id: string; batchId: string; name: string; price: number; capacity: number };
export type CapacityChange = {
  id: string;
  batchId: string;
  tierId: string;
  previous: number;
  next: number;
  delta: number;
  reason: string;
  actor: string;
  createdAt: string;
};
export type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  imageUrl?: string;
  slug?: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  status: 'published' | 'draft' | 'closed';
  accent: string;
  batches: Batch[];
  tiers: Tier[];
  capacityChanges?: CapacityChange[];
  batchStatusChanges?: BatchStatusChange[];
};
export type Ticket = {
  id: string;
  token: string;
  eventId: string;
  tierId: string;
  holder: string;
  email: string;
  source: 'online' | 'publico' | 'cortesia';
  promoter: string;
  price: number;
  paymentStatus: 'approved' | 'reported' | 'complimentary' | 'refunded';
  deliveryStatus?: 'not_configured' | 'queued' | 'sent' | 'failed';
  status: 'valid' | 'used' | 'void';
  createdAt: string;
  usedAt?: string;
};
export type Store = { events: EventItem[]; tickets: Ticket[]; staff?: StaffMember[] };

// Personas ficticias para probar el menú antes de conectar Supabase Auth.
// Estos perfiles NO representan credenciales ni controles de seguridad reales.
export const demoStaff: StaffMember[] = [
  { id: 'demo-admin', name: 'Administración MCF', email: 'admin@ejemplo.com', role: 'admin', active: true, allowedEventIds: [], invitationEventIds: [] },
  { id: 'demo-rrpp-1', name: 'Martina López', email: 'martina@ejemplo.com', role: 'promoter', active: true, allowedEventIds: ['neon-night'], invitationEventIds: [] },
  { id: 'demo-rrpp-2', name: 'Nicolás Duarte', email: 'nicolas@ejemplo.com', role: 'promoter', active: true, allowedEventIds: ['sunset'], invitationEventIds: [] },
];

export const demoEvents: EventItem[] = [
  {
    id: 'neon-night', title: 'NEON NIGHT', subtitle: 'Una noche fuera de lo común',
    date: '2026-12-19', time: '23:00', venue: 'Espacio MCF', city: 'Posadas, Misiones',
    status: 'published', accent: '#ae84ff',
    batches: [
      { id: 'nn-early', name: 'Earlys', status: 'closed' },
      { id: 'nn-lote1', name: 'Lote 1', status: 'active' },
      { id: 'nn-lote2', name: 'Lote 2', status: 'draft' },
    ],
    tiers: [
      { id: 'nn-early-g', batchId: 'nn-early', name: 'General', price: 15000, capacity: 150 },
      { id: 'nn-early-v', batchId: 'nn-early', name: 'VIP', price: 25000, capacity: 60 },
      { id: 'nn-general', batchId: 'nn-lote1', name: 'General', price: 18000, capacity: 250 },
      { id: 'nn-vip', batchId: 'nn-lote1', name: 'VIP', price: 28000, capacity: 80 },
      { id: 'nn-ultra', batchId: 'nn-lote1', name: 'Ultra VIP', price: 42000, capacity: 40 },
      { id: 'nn-l2-g', batchId: 'nn-lote2', name: 'General', price: 22000, capacity: 220 },
      { id: 'nn-l2-v', batchId: 'nn-lote2', name: 'VIP', price: 32000, capacity: 100 },
    ],
  },
  {
    id: 'sunset', title: 'SUNSET SESSION', subtitle: 'Música, atardecer y amigos',
    date: '2027-01-10', time: '19:00', venue: 'Terraza del Río', city: 'Posadas, Misiones',
    status: 'published', accent: '#ffad76',
    batches: [{ id: 'ss-lote1', name: 'Lote 1', status: 'active' }],
    tiers: [
      { id: 'ss-general', batchId: 'ss-lote1', name: 'General', price: 14000, capacity: 300 },
      { id: 'ss-vip', batchId: 'ss-lote1', name: 'VIP', price: 24000, capacity: 80 },
    ],
  },
  {
    id: 'midnight', title: 'MIDNIGHT CLUB', subtitle: 'Próximamente',
    date: '2027-02-14', time: '23:30', venue: 'Ubicación a confirmar', city: 'Posadas, Misiones',
    status: 'draft', accent: '#89e4df',
    batches: [{ id: 'mc-lote1', name: 'Lote 1', status: 'active' }],
    tiers: [{ id: 'mc-general', batchId: 'mc-lote1', name: 'General', price: 20000, capacity: 350 }],
  },
];

const sampleTicket = (index: number, eventId: string, tierId: string, source: Ticket['source'], price: number, used = false): Ticket => ({
  id: `DEMO-${String(index).padStart(5, '0')}`,
  token: `MCF:DEMO-${String(index).padStart(5, '0')}`,
  eventId, tierId,
  holder: ['Lucía Rodríguez', 'Mateo Gómez', 'Sofía Benítez', 'Tomás Pérez', 'Valentina Silva', 'Camila López'][index % 6],
  email: `cliente${index}@ejemplo.com`,
  source,
  promoter: source === 'online' ? '' : source === 'cortesia' ? 'Administración MCF' : index % 2 === 0 ? 'Martina López' : 'Nicolás Duarte',
  price,
  paymentStatus: source === 'online' ? 'approved' : source === 'cortesia' ? 'complimentary' : 'reported',
  deliveryStatus: 'not_configured',
  status: used ? 'used' : 'valid',
  createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  usedAt: used ? new Date(Date.now() - 90 * 60_000).toISOString() : undefined,
});

const initialTickets: Ticket[] = Array.from({ length: 24 }, (_, i) => {
  const isOnline = i % 3 === 0;
  const isCourtesy = i % 8 === 0;
  const event = i < 17 ? demoEvents[0] : demoEvents[1];
  const eligible = event.tiers.filter(t => event.batches.find(b => b.id === t.batchId)?.status !== 'draft');
  const tier = eligible[i % eligible.length];
  return sampleTicket(i + 1, event.id, tier.id, isCourtesy ? 'cortesia' : isOnline ? 'online' : 'publico', isCourtesy ? 0 : tier.price, i % 4 === 0);
});

export const initialStore: Store = { events: demoEvents, tickets: initialTickets, staff: demoStaff };

export function sellableTiers(event: EventItem): Tier[] {
  const active = event.batches.find(batch => batch.status === 'active');
  return active ? event.tiers.filter(tier => tier.batchId === active.id) : [];
}

export function loadStore(): Store {
  try {
    const saved = localStorage.getItem('mcf_tickets_demo_v1');
    if (saved) {
      const parsed = JSON.parse(saved) as Store;
      if (Array.isArray(parsed.events) && Array.isArray(parsed.tickets)) {
        return {
          staff: Array.isArray(parsed.staff) ? parsed.staff
            .filter(member => member && member.id !== 'demo-scanner')
            .map(member => {
              const example = demoStaff.find(demo => demo.id === member.id);
              const isAdmin = member.role === 'admin';
              return {
                id: member.id, name: member.name, email: member.email,
                role: (isAdmin ? 'admin' : 'promoter') as StaffRole,
                active: String(member.role) === 'scanner' ? false : Boolean(member.active),
                allowedEventIds: Array.isArray(member.allowedEventIds)
                  ? member.allowedEventIds.filter((id): id is string => typeof id === 'string')
                  : example?.allowedEventIds ?? [],
                invitationEventIds: Array.isArray(member.invitationEventIds)
                  ? member.invitationEventIds.filter((id): id is string => typeof id === 'string')
                  : [],
              };
            }) : demoStaff,
          events: parsed.events.map(event => {
            if (Array.isArray(event.batches) && event.tiers.every(tier => tier.batchId)) return event;
            const batchId = `legacy-${event.id}`;
            return { ...event, batches: [{ id: batchId, name: 'Lote 1', status: 'active' as const }],
              tiers: event.tiers.map(tier => ({ ...tier, batchId })) };
          }),
          tickets: parsed.tickets.map(ticket => ({ ...ticket, paymentStatus: ticket.paymentStatus ??
            (ticket.source === 'online' ? 'approved' : ticket.source === 'cortesia' ? 'complimentary' : 'reported'),
            deliveryStatus: ticket.deliveryStatus ?? 'not_configured' })),
        };
      }
    }
  } catch { /* Empty or malformed local storage: use fresh demo state. */ }
  return initialStore;
}

export const formatMoney = (amount: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(amount);

export const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
  day: 'numeric', month: 'short', year: 'numeric',
});

export const makeId = () => crypto.randomUUID();

export const slugifyEvent = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

export const eventPublicUrl = (event: EventItem): string =>
  `https://allggames.github.io/MCFTICKETS/#/eventos/${encodeURIComponent(event.slug || event.id)}`;

export function batchSoldOut(event: EventItem, batch: Batch, tickets: Ticket[]): boolean {
  if (batch.status === 'sold_out') return true;
  const tiers = event.tiers.filter(tier => tier.batchId === batch.id);
  if (!tiers.length) return false;
  return tiers.every(tier => tickets.filter(ticket => ticket.eventId === event.id &&
    ticket.tierId === tier.id && ticket.status !== 'void').length >= tier.capacity);
}

export const makeDemoTicket = (
  eventId: string, tierId: string, holder: string, email: string,
  source: Ticket['source'], promoter: string, price: number,
): Ticket => {
  const id = crypto.randomUUID();
  return {
    id, token: `MCF:DEMO:${crypto.randomUUID()}`, eventId, tierId,
    holder, email, source, promoter, price, status: 'valid',
    paymentStatus: source === 'online' ? 'approved' : source === 'cortesia' ? 'complimentary' : 'reported',
    deliveryStatus: 'not_configured',
    createdAt: new Date().toISOString(),
  };
};
