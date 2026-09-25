'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export function Header() {
  const { user, loading } = useAuth();
  const [siteName, setSiteName] = useState('校园墙');
  const [siteLogo, setSiteLogo] = useState('');
  const [banRemain, setBanRemain] = useState('');
  const [unread, setUnread] = useState(0);

  // 封禁倒计时
  useEffect(() => {
    if (!user?.bannedUntil) { setBanRemain(''); return; }
    const calc = () => {
      const until = new Date(user.bannedUntil).getTime();
      const diff = until - Date.now();
      if (diff <= 0) { setBanRemain(''); return; }
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      if (days > 0) setBanRemain(`距离解禁还有 ${days} 天 ${hours} 小时`);
      else if (hours > 0) setBanRemain(`距离解禁还有 ${hours} 小时 ${mins} 分钟`);
      else setBanRemain(`距离解禁还有 ${mins} 分钟`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [user?.bannedUntil]);

  useEffect(() => {
    api.get<{ site_name?: string; site_logo?: string }>('/api/site-config')
      .then(d => {
        if (d.site_name) setSiteName(d.site_name);
        if (d.site_logo) setSiteLogo(d.site_logo);
      })
      .catch(() => {});
  }, []);

  // 未读消息数
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    api.get<{ count: number }>('/api/notifications/unread-count')
      .then(d => setUnread(d.count))
      .catch(() => {});
  }, [user]);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-100">
      {banRemain && (
        <div className="bg-red-500 text-white text-center text-xs py-1.5 px-3">
          <span className="font-semibold">账号封禁中</span> · {banRemain}
          {user?.banReason ? ` · 原因: ${user.banReason}` : ''} · 封禁期间无法发帖、评论
        </div>
      )}
      <div className="mx-auto h-14 flex items-center justify-between px-4" style={{ maxWidth: 640 }}>
        <div className="w-8" />
        <Link href="/" className="flex items-center gap-2 no-underline">
          {siteLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={siteLogo} alt="" className="h-7 w-7 rounded object-contain" />
          ) : null}
          <span className="text-lg font-bold text-slate-900">{siteName}</span>
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <Link href="/notifications" className="relative no-underline" aria-label="消息">
              <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          )}
          <div className="w-8 flex items-center justify-end">
            {loading ? (
              <span className="text-slate-300">…</span>
            ) : user ? (
              <Link href="/profile" className="no-underline">
                <div className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (user.nickname || 'U')[0].toUpperCase()
                  )}
                </div>
              </Link>
            ) : (
              <Link href="/login" className="text-slate-500 text-sm no-underline">登录</Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
