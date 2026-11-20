import React, { createContext, useContext, useState } from 'react';
import { api } from '../api/client';

interface AdminUser {
  username: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('vh_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    localStorage.setItem('vh_admin_token', res.token);
    localStorage.setItem('vh_admin_user', JSON.stringify(res.user));
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('vh_admin_token');
    localStorage.removeItem('vh_admin_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
