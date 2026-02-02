import createContextHook from '@nkzw/create-context-hook';
import { useCallback } from 'react';
import { Event, Seller, Ticket, SalesStats } from '@/types';
import { trpc } from '@/lib/trpc';
import { defaultCommissionTiers } from '@/mocks/data';

export const [AppProvider, useApp] = createContextHook(() => {
  const eventsQuery = trpc.events.list.useQuery();
  const sellersQuery = trpc.sellers.list.useQuery();
  const ticketsQuery = trpc.tickets.list.useQuery();

  const createEventMutation = trpc.events.create.useMutation();
  const updateEventMutation = trpc.events.update.useMutation();
  const deleteEventMutation = trpc.events.delete.useMutation();
  
  const createSellerMutation = trpc.sellers.create.useMutation();
  const updateSellerMutation = trpc.sellers.update.useMutation();
  const deleteSellerMutation = trpc.sellers.delete.useMutation();
  
  const createTicketMutation = trpc.tickets.create.useMutation();
  const validateTicketMutation = trpc.tickets.validate.useMutation();

  const events: Event[] = (eventsQuery.data || []).map(e => ({
    ...e,
    ticketTiers: e.ticketTiers || [],
  }));
  
  const sellers: Seller[] = (sellersQuery.data || []).map(s => ({
    ...s,
    commissionTiers: s.commissionTiers || defaultCommissionTiers,
  }));
  
  const tickets: Ticket[] = (ticketsQuery.data || []).map(t => ({
    id: t.id,
    eventId: t.eventId,
    tierId: t.tierId,
    buyerName: t.buyerName,
    buyerEmail: t.buyerEmail,
    buyerPhone: t.buyerPhone || '',
    qrCode: t.qrCode,
    purchaseDate: t.purchaseDate,
    sellerId: t.sellerId || undefined,
    sellerCode: t.sellerCode || undefined,
    isUsed: t.isUsed,
    usedAt: t.usedAt || undefined,
    paymentMethod: t.paymentMethod as 'card' | 'googlepay' | 'applepay' | 'cash',
    price: t.price,
  }));

  const isLoading = eventsQuery.isLoading || sellersQuery.isLoading || ticketsQuery.isLoading;

  const refetchAll = useCallback(() => {
    eventsQuery.refetch();
    sellersQuery.refetch();
    ticketsQuery.refetch();
  }, [eventsQuery, sellersQuery, ticketsQuery]);

  const addEvent = useCallback(async (event: Omit<Event, 'id' | 'createdAt'>) => {
    const result = await createEventMutation.mutateAsync({
      name: event.name,
      date: event.date,
      time: event.time,
      venue: event.venue,
      location: event.location,
      image: event.image,
      description: event.description,
      promoterId: event.promoterId,
      ticketTiers: event.ticketTiers.map(t => ({
        name: t.name,
        price: t.price,
        quantity: t.quantity,
        description: t.description,
        includesBus: t.includesBus,
        isVip: t.isVip,
      })),
    });
    await eventsQuery.refetch();
    return { ...event, id: result.id, createdAt: new Date().toISOString() };
  }, [createEventMutation, eventsQuery]);

  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    await updateEventMutation.mutateAsync({
      id,
      name: updates.name,
      date: updates.date,
      time: updates.time,
      venue: updates.venue,
      location: updates.location,
      image: updates.image,
      description: updates.description,
      promoterId: updates.promoterId,
      isActive: updates.isActive,
    });
    await eventsQuery.refetch();
  }, [updateEventMutation, eventsQuery]);

  const deleteEvent = useCallback(async (id: string) => {
    await deleteEventMutation.mutateAsync({ id });
    await eventsQuery.refetch();
  }, [deleteEventMutation, eventsQuery]);

  const addSeller = useCallback(async (seller: Omit<Seller, 'id' | 'createdAt' | 'totalSales' | 'totalRevenue' | 'commissionTiers'>) => {
    const result = await createSellerMutation.mutateAsync({
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      code: seller.code,
    });
    await sellersQuery.refetch();
    return {
      ...seller,
      id: result.id,
      createdAt: new Date().toISOString(),
      totalSales: 0,
      totalRevenue: 0,
      commissionTiers: defaultCommissionTiers,
    };
  }, [createSellerMutation, sellersQuery]);

  const updateSeller = useCallback(async (id: string, updates: Partial<Seller>) => {
    await updateSellerMutation.mutateAsync({
      id,
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      isActive: updates.isActive,
      commissionTiers: updates.commissionTiers,
    });
    await sellersQuery.refetch();
  }, [updateSellerMutation, sellersQuery]);

  const deleteSeller = useCallback(async (id: string) => {
    await deleteSellerMutation.mutateAsync({ id });
    await sellersQuery.refetch();
  }, [deleteSellerMutation, sellersQuery]);

  const addTicket = useCallback(async (ticket: Omit<Ticket, 'id' | 'purchaseDate' | 'qrCode' | 'isUsed'> & {
    buyerBirthdate?: string;
    buyerGender?: 'male' | 'female' | 'other' | 'prefer_not_say';
    buyerCity?: string;
    buyerCountry?: string;
  }) => {
    const mutationData = {
      eventId: ticket.eventId,
      tierId: ticket.tierId,
      buyerName: ticket.buyerName,
      buyerEmail: ticket.buyerEmail,
      buyerPhone: ticket.buyerPhone,
      sellerCode: ticket.sellerCode,
      paymentMethod: ticket.paymentMethod,
      // Demographic data - passed through but types not yet generated
      ...(ticket.buyerBirthdate && { buyerBirthdate: ticket.buyerBirthdate }),
      ...(ticket.buyerGender && { buyerGender: ticket.buyerGender }),
      ...(ticket.buyerCity && { buyerCity: ticket.buyerCity }),
      ...(ticket.buyerCountry && { buyerCountry: ticket.buyerCountry }),
    } as Parameters<typeof createTicketMutation.mutateAsync>[0];
    const result = await createTicketMutation.mutateAsync(mutationData);
    await eventsQuery.refetch();
    await ticketsQuery.refetch();
    await sellersQuery.refetch();
    return {
      ...ticket,
      id: result.id,
      qrCode: result.qrCode,
      purchaseDate: new Date().toISOString(),
      isUsed: false,
    };
  }, [createTicketMutation, eventsQuery, ticketsQuery, sellersQuery]);

  const validateTicket = useCallback(async (qrCode: string): Promise<{ success: boolean; ticket?: Ticket; message: string }> => {
    const result = await validateTicketMutation.mutateAsync({ qrCode });
    await ticketsQuery.refetch();
    
    if (!result.success) {
      return { 
        success: false, 
        message: result.message,
        ticket: result.ticket ? {
          id: result.ticket.id,
          eventId: '',
          tierId: '',
          buyerName: result.ticket.buyerName,
          buyerEmail: '',
          buyerPhone: '',
          qrCode,
          purchaseDate: '',
          isUsed: result.ticket.isUsed,
          usedAt: result.ticket.usedAt || undefined,
          paymentMethod: 'card',
          price: 0,
        } : undefined,
      };
    }

    return { 
      success: true, 
      message: result.message,
      ticket: result.ticket ? {
        id: result.ticket.id,
        eventId: '',
        tierId: '',
        buyerName: result.ticket.buyerName,
        buyerEmail: '',
        buyerPhone: '',
        qrCode,
        purchaseDate: '',
        isUsed: true,
        usedAt: result.ticket.usedAt || undefined,
        paymentMethod: 'card',
        price: 0,
      } : undefined,
    };
  }, [validateTicketMutation, ticketsQuery]);

  const getStats = useCallback((): SalesStats => {
    const today = new Date().toDateString();
    const todayTickets = tickets.filter(t => new Date(t.purchaseDate).toDateString() === today);
    
    return {
      totalRevenue: tickets.reduce((sum, t) => sum + t.price, 0),
      totalTicketsSold: tickets.length,
      todayRevenue: todayTickets.reduce((sum, t) => sum + t.price, 0),
      todayTickets: todayTickets.length,
      pendingWithdrawal: tickets.reduce((sum, t) => sum + t.price, 0) * 0.95,
    };
  }, [tickets]);

  const getEventTickets = useCallback((eventId: string) => {
    return tickets.filter(t => t.eventId === eventId);
  }, [tickets]);

  const getSellerByCode = useCallback((code: string) => {
    return sellers.find(s => s.code.toLowerCase() === code.toLowerCase() && s.isActive);
  }, [sellers]);

  return {
    events,
    sellers,
    tickets,
    isLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    addSeller,
    updateSeller,
    deleteSeller,
    addTicket,
    validateTicket,
    getStats,
    getEventTickets,
    getSellerByCode,
    refetchAll,
  };
});
