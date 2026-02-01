export interface TicketExtra {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  description: string;
  includesBus?: boolean;
  isVip?: boolean;
  extras?: TicketExtra[];
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
  promoterId?: string;
  promoterName?: string;
  promoterCompany?: string;
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

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  sellerId?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Promoter {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
  stripeAccountId?: string;
  stripeAccountStatus: 'pending' | 'active' | 'disabled';
  commissionPercentage: number;
  isActive: boolean;
  createdAt: string;
  eventCount?: number;
  totalEarnings?: number;
  pendingPayout?: number;
}

export interface PromoterPayout {
  id: string;
  promoterId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripeTransferId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTicketsSold: number;
  platformEarnings: number;
  todayRevenue: number;
  todayTickets: number;
  totalEvents: number;
  activeEvents: number;
  totalSellers: number;
  totalPromoters: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  maxEventsPerMonth: number;
  priceMonthly: number;
  isActive: boolean;
  sortOrder: number;
}

export interface PromoterSubscription {
  id: string;
  promoterId: string;
  planId: string;
  planName: string;
  maxEventsPerMonth: number;
  priceMonthly: number;
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  eventsUsedThisMonth: number;
  stripeSubscriptionId?: string;
}
