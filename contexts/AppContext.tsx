import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { Event, Seller, Ticket, SalesStats } from '@/types';
import { mockEvents, mockSellers, mockTickets, defaultCommissionTiers } from '@/mocks/data';

const STORAGE_KEYS = {
  EVENTS: 'ticketera_events',
  SELLERS: 'ticketera_sellers',
  TICKETS: 'ticketera_tickets',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [sellers, setSellers] = useState<Seller[]>(mockSellers);
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsData, sellersData, ticketsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.EVENTS),
        AsyncStorage.getItem(STORAGE_KEYS.SELLERS),
        AsyncStorage.getItem(STORAGE_KEYS.TICKETS),
      ]);

      if (eventsData) setEvents(JSON.parse(eventsData));
      if (sellersData) setSellers(JSON.parse(sellersData));
      if (ticketsData) setTickets(JSON.parse(ticketsData));
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveEvents = async (newEvents: Event[]) => {
    setEvents(newEvents);
    await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(newEvents));
  };

  const saveSellers = async (newSellers: Seller[]) => {
    setSellers(newSellers);
    await AsyncStorage.setItem(STORAGE_KEYS.SELLERS, JSON.stringify(newSellers));
  };

  const saveTickets = async (newTickets: Ticket[]) => {
    setTickets(newTickets);
    await AsyncStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(newTickets));
  };

  const addEvent = useCallback(async (event: Omit<Event, 'id' | 'createdAt'>) => {
    const newEvent: Event = {
      ...event,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...events, newEvent];
    await saveEvents(updated);
    return newEvent;
  }, [events]);

  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    const updated = events.map(e => e.id === id ? { ...e, ...updates } : e);
    await saveEvents(updated);
  }, [events]);

  const deleteEvent = useCallback(async (id: string) => {
    const updated = events.filter(e => e.id !== id);
    await saveEvents(updated);
  }, [events]);

  const addSeller = useCallback(async (seller: Omit<Seller, 'id' | 'createdAt' | 'totalSales' | 'totalRevenue' | 'commissionTiers'>) => {
    const newSeller: Seller = {
      ...seller,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      totalSales: 0,
      totalRevenue: 0,
      commissionTiers: defaultCommissionTiers,
    };
    const updated = [...sellers, newSeller];
    await saveSellers(updated);
    return newSeller;
  }, [sellers]);

  const updateSeller = useCallback(async (id: string, updates: Partial<Seller>) => {
    const updated = sellers.map(s => s.id === id ? { ...s, ...updates } : s);
    await saveSellers(updated);
  }, [sellers]);

  const deleteSeller = useCallback(async (id: string) => {
    const updated = sellers.filter(s => s.id !== id);
    await saveSellers(updated);
  }, [sellers]);

  const addTicket = useCallback(async (ticket: Omit<Ticket, 'id' | 'purchaseDate' | 'qrCode' | 'isUsed'>) => {
    const newTicket: Ticket = {
      ...ticket,
      id: Date.now().toString(),
      purchaseDate: new Date().toISOString(),
      qrCode: `${ticket.eventId}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      isUsed: false,
    };
    const updated = [...tickets, newTicket];
    await saveTickets(updated);

    const event = events.find(e => e.id === ticket.eventId);
    if (event) {
      const updatedTiers = event.ticketTiers.map(t => 
        t.id === ticket.tierId ? { ...t, sold: t.sold + 1 } : t
      );
      await updateEvent(event.id, { ticketTiers: updatedTiers });
    }

    if (ticket.sellerId) {
      const seller = sellers.find(s => s.id === ticket.sellerId);
      if (seller) {
        await updateSeller(seller.id, {
          totalSales: seller.totalSales + 1,
          totalRevenue: seller.totalRevenue + ticket.price,
        });
      }
    }

    return newTicket;
  }, [tickets, events, sellers, updateEvent, updateSeller]);

  const validateTicket = useCallback(async (qrCode: string): Promise<{ success: boolean; ticket?: Ticket; message: string }> => {
    const ticket = tickets.find(t => t.qrCode === qrCode);
    
    if (!ticket) {
      return { success: false, message: 'Entrada no encontrada' };
    }

    if (ticket.isUsed) {
      return { success: false, ticket, message: `Entrada ya usada el ${new Date(ticket.usedAt!).toLocaleString()}` };
    }

    const updated = tickets.map(t => 
      t.id === ticket.id ? { ...t, isUsed: true, usedAt: new Date().toISOString() } : t
    );
    await saveTickets(updated);

    return { success: true, ticket: { ...ticket, isUsed: true }, message: 'Entrada válida ✓' };
  }, [tickets]);

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
  };
});
