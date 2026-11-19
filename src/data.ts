export type Tier = { id: string; name: string; price: number; capacity: number };
export type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  status: 'published' | 'draft' | 'closed';
  accent: string;
  tiers: Tier[];
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
  status: 'valid' | 'used' | 'void';
  createdAt: string;
  usedAt?: string;
};
export type Store = { events: EventItem[]; tickets: Ticket[] };

export const demoEvents: EventItem[] = [
  {
    id: 'neon-night', title: 'NEON NIGHT', subtitle: 'Una noche fuera de lo común',
    date: '2026-12-19', time: '23:00', venue: 'Espacio MCF', city: 'Posadas, Misiones',
    status: 'published', accent: '#ae84ff',
    tiers: [
      { id: 'nn-general', name: 'General', price: 18000, capacity: 400 },
      { id: 'nn-vip', name: 'VIP', price: 28000, capacity: 120 },
      { id: 'nn-ultra', name: 'Ultra VIP', price: 42000, capacity: 40 },
    ],
  },
  {
    id: 'sunset', title: 'SUNSET SESSION', subtitle: 'Música, atardecer y amigos',
    date: '2027-01-10', time: '19:00', venue: 'Terraza del Río', city: 'Posadas, Misiones',
    status: 'published', accent: '#ffad76',
    tiers: [
      { id: 'ss-general', name: 'General', price: 14000, capacity: 300 },
      { id: 'ss-vip', name: 'VIP', price: 24000, capacity: 80 },
    ],
  },
  {
    id: 'midnight', title: 'MIDNIGHT CLUB', subtitle: 'Próximamente',
    date: '2027-02-14', time: '23:30', venue: 'Ubicación a confirmar', city: 'Posadas, Misiones',
    status: 'draft', accent: '#89e4df',
    tiers: [{ id: 'mc-general', name: 'General', price: 20000, capacity: 350 }],
  },
];

const sampleTicket = (index: number, eventId: string, tierId: string, source: Ticket['source'], price: number, used = false): Ticket => ({
  id: `DEMO-${String(index).padStart(5, '0')}`,
  token: `MCF:DEMO-${String(index).padStart(5, '0')}`,
  eventId, tierId,
  holder: ['Lucía Rodríguez', 'Mateo Gómez', 'Sofía Benítez', 'Tomás Pérez', 'Valentina Silva', 'Camila López'][index % 6],
  email: `cliente${index}@ejemplo.com`,
  source,
  promoter: source === 'online' ? '' : index % 2 === 0 ? 'Martina López' : 'Nicolás Duarte',
  price,
  status: used ? 'used' : 'valid',
  createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  usedAt: used ? new Date(Date.now() - 90 * 60_000).toISOString() : undefined,
});

const initialTickets: Ticket[] = Array.from({ length: 24 }, (_, i) => {
  const isOnline = i % 3 === 0;
  const isCourtesy = i % 8 === 0;
  const event = i < 17 ? demoEvents[0] : demoEvents[1];
  const tier = event.tiers[i % event.tiers.length];
  return sampleTicket(i + 1, event.id, tier.id, isCourtesy ? 'cortesia' : isOnline ? 'online' : 'publico', isCourtesy ? 0 : tier.price, i % 4 === 0);
});

export const initialStore: Store = { events: demoEvents, tickets: initialTickets };

export function loadStore(): Store {
  try {
    const saved = localStorage.getItem('mcf_tickets_demo_v1');
    if (saved) {
      const parsed = JSON.parse(saved) as Store;
      if (Array.isArray(parsed.events) && Array.isArray(parsed.tickets)) return parsed;
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

export const makeDemoTicket = (
  eventId: string, tierId: string, holder: string, email: string,
  source: Ticket['source'], promoter: string, price: number,
): Ticket => {
  const id = crypto.randomUUID();
  return {
    id, token: `MCF:DEMO:${crypto.randomUUID()}`, eventId, tierId,
    holder, email, source, promoter, price, status: 'valid', createdAt: new Date().toISOString(),
  };
};
