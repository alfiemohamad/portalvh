import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SessionUser } from '../types';

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  checkingSession: boolean;
  hasRole: (role: string) => boolean;
  loginResident: (block: string, houseNo: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSavedUser(): SessionUser | null {
  try {
    const saved = localStorage.getItem('vh_user');
    const token = localStorage.getItem('vh_token');
    if (!saved || !token) return null;
    return JSON.parse(saved) as SessionUser;
  } catch {
    localStorage.removeItem('vh_user');
    localStorage.removeItem('vh_token');
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(loadSavedUser);
  const [checkingSession, setCheckingSession] = useState<boolean>(() => !!localStorage.getItem('vh_token'));

  const clearSession = () => {
    localStorage.removeItem('vh_token');
    localStorage.removeItem('vh_user');
    setUser(null);
  };

  useEffect(() => {
    const onUnauthorized = () => clearSession();
    window.addEventListener('vh:unauthorized', onUnauthorized);

    if (localStorage.getItem('vh_token')) {
      api
        .getMe()
        .then((res) => {
          localStorage.setItem('vh_user', JSON.stringify(res.user));
          setUser(res.user);
        })
        .catch(() => {
          clearSession();
        })
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }

    return () => window.removeEventListener('vh:unauthorized', onUnauthorized);
  }, []);

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
    if (localStorage.getItem('vh_token')) {
      api.logout().catch(() => {});
    }
    clearSession();
  };

  const hasRole = (role: string) => {
    if (!user) return false;
    const target = role.toLowerCase();
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.map((p) => p.toLowerCase()).includes(target);
    }
    const r = user.role.toLowerCase();
    if (r === 'pengurus' || r === 'admin') {
      return ['admin', 'pengurus', 'bendahara', 'keamanan', 'warga'].includes(target);
    }
    return r === target;
  };

  const isAdmin = hasRole('admin') || hasRole('bendahara') || hasRole('keamanan');

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin,
        checkingSession,
        hasRole,
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
