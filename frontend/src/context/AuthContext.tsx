import React, { createContext, useContext, useState } from 'react';
import { api } from '../api/client';
import type { SessionUser } from '../types';

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loginResident: (block: string, houseNo: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const saved = localStorage.getItem('vh_user');
    return saved ? JSON.parse(saved) : null;
  });

  const saveSession = (token: string, u: SessionUser) => {
    localStorage.setItem('vh_token', token);
    localStorage.setItem('vh_user', JSON.stringify(u));
    setUser(u);
  };

  const loginResident = async (block: string, houseNo: string, password: string) => {
    const res = await api.loginResident(block, houseNo, password);
    saveSession(res.token, res.user);
  };

  const loginAdmin = async (username: string, password: string) => {
    const res = await api.loginAdmin(username, password);
    saveSession(res.token, res.user);
  };

  const logout = () => {
    localStorage.removeItem('vh_token');
    localStorage.removeItem('vh_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'Pengurus',
        loginResident,
        loginAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
