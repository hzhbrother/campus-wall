'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export type Role = 'USER' | 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string | null;
  nickname: string;
  avatar?: string | null;
  pendingAvatar?: string | null;
  avatarStatus?: string;
  avatarRejectReason?: string | null;
  coverImage?: string | null;
  realName?: string | null;
  studentId?: string | null;
  countryCode?: string | null;
  phoneNumber?: string | null;
  grade?: string | null;
  className?: string | null;
  remark?: string | null;
  role: Role;
  roleId?: string | null;
  customRole?: { id: string; name: string; permissions: string[] } | null;
  verified?: boolean;
  verifiedAt?: string | null;
  verificationStatus?: string;
  verificationRejectReason?: string | null;
  qualificationType?: string | null;
  qualificationVerified?: boolean;
  qualificationVerifiedAt?: string | null;
  qualificationStatus?: string;
  qualificationRejectReason?: string | null;
  createdAt?: string;
  bannedUntil?: string | null;
  points?: number;
  userNumber?: number | null;
  schoolId?: string | null;
  organizationId?: string | null;
  school?: { id: string; name: string; stage?: string | null } | null;
  organization?: { id: string; name: string } | null;
  credibilityScore?: number;
  banReason?: string | null;
  _count?: { posts: number; comments: number; likes: number; likesReceived: number };
}

// 多账号: 存储在 localStorage 中的已登录账号列表
export interface SavedAccount {
  token: string;
  userId: string;
  nickname: string;
  avatar?: string | null;
  role: Role;
}

const ACCOUNTS_KEY = 'cw_accounts';
const TOKEN_KEY = 'cw_token';

function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAccounts(list: SavedAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

// 只在 login/register 时调用, 不在 fetchMe 里调 (避免竞态+不必要截断)
function upsertAccount(user: AuthUser, token: string, max = 3) {
  const list = getSavedAccounts().filter(a => a.userId !== user.id);
  list.unshift({ token, userId: user.id, nickname: user.nickname, avatar: user.avatar, role: user.role });
  saveAccounts(list.slice(0, max));
}

// 更新已有账号信息 (不改变顺序, 不截断)
function updateAccountInfo(user: AuthUser) {
  const list = getSavedAccounts();
  const idx = list.findIndex(a => a.userId === user.id);
  if (idx >= 0) {
    list[idx].nickname = user.nickname;
    list[idx].avatar = user.avatar;
    list[idx].role = user.role;
    saveAccounts(list);
  }
}

function removeAccount(userId: string) {
  saveAccounts(getSavedAccounts().filter(a => a.userId !== userId));
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<AuthUser>;
  register: (data: { nickname: string; email: string; emailCode: string; password: string; realName?: string; remark?: string }) => Promise<AuthUser>;
  applyToken: (token: string) => Promise<AuthUser | null>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  savedAccounts: SavedAccount[];
  switchAccount: (userId: string) => Promise<AuthUser | null>;
  removeSavedAccount: (userId: string) => void;
  maxAccounts: number;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [maxAccounts, setMaxAccounts] = useState(3);
  const [configLoaded, setConfigLoaded] = useState(false);

  // 加载 maxAccounts 配置
  useEffect(() => {
    api.get<{ max_accounts?: string }>('/api/site-config')
      .then(d => {
        const v = parseInt(d.max_accounts || '3', 10);
        if (!isNaN(v) && v >= 1) setMaxAccounts(v);
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  // Bug2 修复: maxAccounts 加载后, 对已存的 accounts 做一次截断清理
  useEffect(() => {
    if (!configLoaded) return;
    const list = getSavedAccounts();
    if (list.length > maxAccounts) {
      saveAccounts(list.slice(0, maxAccounts));
      setSavedAccounts(getSavedAccounts());
    }
  }, [configLoaded, maxAccounts]);

  // Bug1 修复: fetchMe 不调 upsertAccount, 只更新已有账号的显示信息
  const fetchMe = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const me = await api.get<AuthUser>('/api/auth/me');
      setUser(me);
      updateAccountInfo(me);
      setSavedAccounts(getSavedAccounts());
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(TOKEN_KEY)) {
      setSavedAccounts(getSavedAccounts());
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const applyToken = useCallback(async (token: string): Promise<AuthUser | null> => {
    localStorage.setItem(TOKEN_KEY, token);
    return fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (account: string, password: string): Promise<AuthUser> => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { account, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    upsertAccount(res.user, res.token, maxAccounts);
    setSavedAccounts(getSavedAccounts());
    setUser(res.user);
    return res.user;
  }, [maxAccounts]);

  const register = useCallback(async (data: { nickname: string; email: string; emailCode: string; password: string; realName?: string; grade?: string; className?: string; remark?: string }): Promise<AuthUser> => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', data);
    localStorage.setItem(TOKEN_KEY, res.token);
    upsertAccount(res.user, res.token, maxAccounts);
    setSavedAccounts(getSavedAccounts());
    setUser(res.user);
    return res.user;
  }, [maxAccounts]);

  const logout = useCallback(() => {
    if (user) removeAccount(user.id);
    localStorage.removeItem(TOKEN_KEY);
    setSavedAccounts(getSavedAccounts());
    setUser(null);
  }, [user]);

  // Bug3 修复: 切换失败时移除过期账号, 尝试回退到之前的 token
  const switchAccount = useCallback(async (userId: string): Promise<AuthUser | null> => {
    const acc = getSavedAccounts().find(a => a.userId === userId);
    if (!acc) return null;
    const prevToken = localStorage.getItem(TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, acc.token);
    const me = await fetchMe();
    if (!me) {
      // 切换失败: token 可能过期, 移除该账号
      removeAccount(userId);
      setSavedAccounts(getSavedAccounts());
      // 回退到之前的 token (如果有)
      if (prevToken) {
        localStorage.setItem(TOKEN_KEY, prevToken);
        await fetchMe();
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
      throw new Error('该账号登录已过期, 请重新登录');
    }
    return me;
  }, [fetchMe]);

  const removeSavedAccount = useCallback((userId: string) => {
    removeAccount(userId);
    setSavedAccounts(getSavedAccounts());
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, applyToken, logout, refreshUser: fetchMe, savedAccounts, switchAccount, removeSavedAccount, maxAccounts }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
