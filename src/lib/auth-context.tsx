'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export type Role = 'USER' | 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string | null;
  nickname: string;
  avatar?: string | null;
  coverImage?: string | null;
  realName?: string | null;
  countryCode?: string | null;
  phoneNumber?: string | null;
  grade?: string | null;
  className?: string | null;
  remark?: string | null;
  role: Role;
  verified?: boolean;
  verificationStatus?: string;
  verificationRejectReason?: string | null;
  createdAt?: string;
  bannedUntil?: string | null;
  banReason?: string | null;
  _count?: { posts: number; comments: number; likes: number; likesReceived: number };
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<AuthUser>;
  register: (data: { nickname: string; email: string; emailCode: string; password: string; realName?: string; grade?: string; className?: string; remark?: string }) => Promise<AuthUser>;
  applyToken: (token: string) => Promise<AuthUser | null>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const me = await api.get<AuthUser>('/api/auth/me');
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
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

  const applyToken = useCallback(async (token: string): Promise<AuthUser | null> => {
    localStorage.setItem('cw_token', token);
    return fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (account: string, password: string): Promise<AuthUser> => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { account, password });
    localStorage.setItem('cw_token', res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: { nickname: string; email: string; emailCode: string; password: string; realName?: string; grade?: string; className?: string; remark?: string }): Promise<AuthUser> => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', data);
    localStorage.setItem('cw_token', res.token);
    setUser(res.user);
    return res.user;
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
