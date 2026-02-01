import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { trpc } from '@/lib/trpc';

const STORAGE_KEYS = {
  USER: 'ticketera_user',
  USERS: 'ticketera_users',
  BUYER_EMAIL: 'ticketera_buyer_email',
};

const defaultUsers: User[] = [
  {
    id: 'admin-1',
    email: 'admin@ticketera.com',
    name: 'Administrador',
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seller-1',
    email: 'vendedor@ticketera.com',
    name: 'Vendedor Demo',
    phone: '+34 600 000 000',
    role: 'seller',
    isActive: true,
    createdAt: new Date().toISOString(),
    sellerId: '1',
  },
];

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(defaultUsers);
  const [isLoading, setIsLoading] = useState(true);
  const [buyerEmail, setBuyerEmail] = useState<string | null>(null);

  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      const [userData, usersData, buyerEmailData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.USERS),
        AsyncStorage.getItem(STORAGE_KEYS.BUYER_EMAIL),
      ]);

      if (userData) {
        setUser(JSON.parse(userData));
      }
      if (usersData) {
        setUsers(JSON.parse(usersData));
      }
      if (buyerEmailData) {
        setBuyerEmail(buyerEmailData);
      }
    } catch (error) {
      console.log('Error loading auth data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUsers = async (newUsers: User[]) => {
    setUsers(newUsers);
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
  };

  const loginMutation = trpc.auth.login.useMutation();

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      
      if (result.success && result.user) {
        const loggedUser: User = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role as UserRole,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        
        setUser(loggedUser);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(loggedUser));
        
        return { success: true, message: 'Inicio de sesión exitoso' };
      }
      
      return { success: false, message: 'Error al iniciar sesión' };
    } catch (error: any) {
      console.log('Login error:', error);
      return { success: false, message: error.message || 'Error al iniciar sesión' };
    }
  }, [loginMutation]);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  }, []);

  const registerUser = useCallback(async (
    userData: Omit<User, 'id' | 'createdAt' | 'isActive'>
  ): Promise<{ success: boolean; message: string; user?: User }> => {
    const existingUser = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    
    if (existingUser) {
      return { success: false, message: 'Este email ya está registrado' };
    }

    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    const updated = [...users, newUser];
    await saveUsers(updated);
    
    return { success: true, message: 'Usuario registrado correctamente', user: newUser };
  }, [users]);

  const saveBuyerEmail = useCallback(async (email: string) => {
    setBuyerEmail(email);
    await AsyncStorage.setItem(STORAGE_KEYS.BUYER_EMAIL, email);
  }, []);

  const canAccessAdmin = useCallback(() => {
    return user?.role === 'admin' || user?.role === 'seller';
  }, [user]);

  const isAdmin = useCallback(() => {
    return user?.role === 'admin';
  }, [user]);

  const isSeller = useCallback(() => {
    return user?.role === 'seller';
  }, [user]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    const updated = users.map(u => u.id === id ? { ...u, ...updates } : u);
    await saveUsers(updated);
    
    if (user?.id === id) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    }
  }, [users, user]);

  const getAllUsers = useCallback(() => {
    return users;
  }, [users]);

  const getUsersByRole = useCallback((role: UserRole) => {
    return users.filter(u => u.role === role);
  }, [users]);

  return {
    user,
    users,
    isLoading,
    isAuthenticated: !!user,
    buyerEmail,
    login,
    logout,
    registerUser,
    saveBuyerEmail,
    canAccessAdmin,
    isAdmin,
    isSeller,
    updateUser,
    getAllUsers,
    getUsersByRole,
  };
});
