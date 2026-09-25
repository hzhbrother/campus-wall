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
  bannedUntil?: string | null;
  banReason?: string | null;
  _count?: { posts: number; comments: number; likes: number };
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<void>;
  register: (data: { nickname: string; password: string; realName?: string; grade?: string; className?: string; remark?: string }) => Promise<void>;
  applyToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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

  const login = useCallback(async (account: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { account, password });
    localStorage.setItem('cw_token', res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: { nickname: string; password: string; realName?: string; grade?: string; className?: string; remark?: string }) => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', data);
    localStorage.setItem('cw_token', res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cw_token');
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, applyToken, logout, refreshUser: fetchMe }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
