'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-100">
      <div className="mx-auto h-14 flex items-center justify-between px-4" style={{ maxWidth: 640 }}>
        <div className="w-8" />
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="text-lg font-bold text-slate-900">校园墙</span>
        </Link>
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
    </header>
  );
}
