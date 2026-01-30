export interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  description: string;
  includesBus?: boolean;
  isVip?: boolean;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  image: string;
  description: string;
  ticketTiers: TicketTier[];
  isActive: boolean;
  createdAt: string;
}

export interface CommissionTier {
  minSales: number;
  maxSales: number | null;
  percentage: number;
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  code: string;
  totalSales: number;
  totalRevenue: number;
  commissionTiers: CommissionTier[];
  isActive: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  tierId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  qrCode: string;
  purchaseDate: string;
  sellerId?: string;
  sellerCode?: string;
  isUsed: boolean;
  usedAt?: string;
  paymentMethod: 'card' | 'googlepay' | 'applepay' | 'cash';
  price: number;
}

export interface SalesStats {
  totalRevenue: number;
  totalTicketsSold: number;
  todayRevenue: number;
  todayTickets: number;
  pendingWithdrawal: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'googlepay' | 'applepay';
  label: string;
  icon: string;
  enabled: boolean;
}
