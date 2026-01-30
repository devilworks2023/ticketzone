import { Event, Seller, Ticket, SalesStats, CommissionTier } from '@/types';

export const defaultCommissionTiers: CommissionTier[] = [
  { minSales: 0, maxSales: 10, percentage: 5 },
  { minSales: 11, maxSales: 50, percentage: 8 },
  { minSales: 51, maxSales: 100, percentage: 10 },
  { minSales: 101, maxSales: null, percentage: 12 },
];

export const mockEvents: Event[] = [
  {
    id: '1',
    name: 'NEON NIGHTS',
    date: '2026-02-14',
    time: '23:00',
    venue: 'Warehouse Club',
    location: 'Barcelona, España',
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800',
    description: 'La fiesta de techno más grande del año. 3 salas, 12 DJs internacionales.',
    ticketTiers: [
      { id: 't1', name: 'Early Bird', price: 15, quantity: 200, sold: 200, description: 'Entrada anticipada limitada' },
      { id: 't2', name: 'General', price: 25, quantity: 500, sold: 312, description: 'Entrada general' },
      { id: 't3', name: 'VIP', price: 60, quantity: 100, sold: 45, description: 'Acceso VIP + copa incluida', isVip: true },
      { id: 't4', name: 'VIP + Bus', price: 80, quantity: 50, sold: 28, description: 'VIP + transporte desde Madrid', isVip: true, includesBus: true },
    ],
    isActive: true,
    createdAt: '2026-01-15',
  },
  {
    id: '2',
    name: 'UNDERGROUND SESSIONS',
    date: '2026-02-28',
    time: '00:00',
    venue: 'The Bunker',
    location: 'Madrid, España',
    image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800',
    description: 'Sesión íntima de house y techno underground.',
    ticketTiers: [
      { id: 't1', name: 'General', price: 20, quantity: 300, sold: 89, description: 'Entrada general' },
      { id: 't2', name: 'VIP Mesa', price: 150, quantity: 20, sold: 8, description: 'Mesa VIP para 4 personas + botella', isVip: true },
    ],
    isActive: true,
    createdAt: '2026-01-20',
  },
];

export const mockSellers: Seller[] = [
  {
    id: 's1',
    name: 'Carlos Martínez',
    email: 'carlos@email.com',
    phone: '+34 612 345 678',
    code: 'CARLOS2026',
    totalSales: 78,
    totalRevenue: 2340,
    commissionTiers: defaultCommissionTiers,
    isActive: true,
    createdAt: '2026-01-10',
  },
  {
    id: 's2',
    name: 'María López',
    email: 'maria@email.com',
    phone: '+34 623 456 789',
    code: 'MARIA2026',
    totalSales: 156,
    totalRevenue: 4680,
    commissionTiers: defaultCommissionTiers,
    isActive: true,
    createdAt: '2026-01-12',
  },
  {
    id: 's3',
    name: 'DJ Promo Team',
    email: 'promo@djteam.com',
    phone: '+34 634 567 890',
    code: 'DJTEAM',
    totalSales: 234,
    totalRevenue: 7020,
    commissionTiers: [
      { minSales: 0, maxSales: 20, percentage: 8 },
      { minSales: 21, maxSales: 100, percentage: 12 },
      { minSales: 101, maxSales: null, percentage: 15 },
    ],
    isActive: true,
    createdAt: '2026-01-08',
  },
];

export const mockTickets: Ticket[] = [
  {
    id: 'tick1',
    eventId: '1',
    tierId: 't2',
    buyerName: 'Juan García',
    buyerEmail: 'juan@email.com',
    buyerPhone: '+34 655 123 456',
    qrCode: 'NEON-001-JUAN',
    purchaseDate: '2026-01-25T14:30:00',
    sellerId: 's1',
    sellerCode: 'CARLOS2026',
    isUsed: false,
    paymentMethod: 'card',
    price: 25,
  },
  {
    id: 'tick2',
    eventId: '1',
    tierId: 't3',
    buyerName: 'Ana Rodríguez',
    buyerEmail: 'ana@email.com',
    buyerPhone: '+34 666 234 567',
    qrCode: 'NEON-002-ANA',
    purchaseDate: '2026-01-26T10:15:00',
    isUsed: true,
    usedAt: '2026-02-14T23:45:00',
    paymentMethod: 'googlepay',
    price: 60,
  },
];

export const mockStats: SalesStats = {
  totalRevenue: 24560,
  totalTicketsSold: 682,
  todayRevenue: 1250,
  todayTickets: 34,
  pendingWithdrawal: 18420,
};
