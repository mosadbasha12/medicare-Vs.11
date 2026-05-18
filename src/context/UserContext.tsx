import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getStoredUser, initializeAdminAccount, initializeOwnerAccount } from '../utils/storage';
import type { AppUser } from '../types';

interface UserContextType {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await initializeAdminAccount();
      await initializeOwnerAccount();
      const savedUser = await getStoredUser();
      if (savedUser) setUser(savedUser);
      setIsLoading(false);
    };
    loadData();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
