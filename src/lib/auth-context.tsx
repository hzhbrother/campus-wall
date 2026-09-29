'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export type Role = 'USER' | 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string | null;
  nickname: string;
  avatar?: string | null;
  // 待审核的新头像 (审核通过后才会替换 avatar)
  pendingAvatar?: string | null;
  // 头像审核状态: PENDING / APPROVED / REJECTED
  avatarStatus?: string;
  // 头像驳回原因
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
  // 资质认证 (组织身份)
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

function upsertAccount(user: AuthUser, token: string, max = 3) {
  const list = getSavedAccounts().filter(a => a.userId !== user.id);
  list.unshift({
    token,
    userId: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
  });
  // 超过上限: 保留最新的 max 个 (最旧的会被丢弃)
  saveAccounts(list.slice(0, max));
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
  // 多账号
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

  // 加载 maxAccounts 配置
  useEffect(() => {
    api.get<{ max_accounts?: string }>('/api/site-config')
      .then(d => {
        const v = parseInt(d.max_accounts || '3', 10);
        if (!isNaN(v) && v >= 1) setMaxAccounts(v);
      })
      .catch(() => {});
  }, []);

  const fetchMe = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const me = await api.get<AuthUser>('/api/auth/me');
      setUser(me);
      // 更新 savedAccounts 中的信息 (头像/昵称可能变了)
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) upsertAccount(me, token, maxAccounts);
      setSavedAccounts(getSavedAccounts());
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [maxAccounts]);

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

  // 切换账号: 直接用已保存的 token, 无需重新输入密码
  const switchAccount = useCallback(async (userId: string): Promise<AuthUser | null> => {
    const acc = getSavedAccounts().find(a => a.userId === userId);
    if (!acc) return null;
    localStorage.setItem(TOKEN_KEY, acc.token);
    return fetchMe();
  }, [fetchMe]);

  const removeSavedAccount = useCallback((userId: string) => {
    removeAccount(userId);
    setSavedAccounts(getSavedAccounts());
  }, []);

  // 监听 api.ts 派发的 401 事件: 清除用户态让 UI 自然降级
  // 不删除 token, 保留以便下次刷新时重新验证 (避免瞬时 401 导致误登出)
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
