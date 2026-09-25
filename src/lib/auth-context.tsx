'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string | null;
  nickname: string;
  avatar?: string | null;
  role: Role;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; nickname: string; studentId?: string }) => Promise<void>;
  applyToken: (token: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<AuthUser>('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('cw_token')) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const applyToken = useCallback(async (token: string) => {
    localStorage.setItem('cw_token', token);
    await fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { email, password });
    localStorage.setItem('cw_token', res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: { email: string; password: string; nickname: string; studentId?: string }) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', data);
    localStorage.setItem('cw_token', res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cw_token');
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, applyToken, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
