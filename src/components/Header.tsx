'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export function Header() {
  const { user, loading } = useAuth();
  const [unread, setUnread] = useState(0);
  const [siteName, setSiteName] = useState('校园墙');
  const [siteLogo, setSiteLogo] = useState('');

  useEffect(() => {
    if (!user) return;
    api.get<{ count: number }>('/api/notifications/unread-count')
      .then(d => setUnread(d.count))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    api.get<{ site_name?: string; site_logo?: string }>('/api/site-config')
      .then(d => {
        if (d.site_name) setSiteName(d.site_name);
        if (d.site_logo) setSiteLogo(d.site_logo);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-100">
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
            <Link href="/notifications" className="relative no-underline text-slate-500">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
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
