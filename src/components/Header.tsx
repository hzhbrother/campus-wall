'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const { user, loading, logout } = useAuth();
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-brand-600 font-bold text-lg no-underline">
          <span className="inline-flex w-8 h-8 rounded-lg bg-brand-600 text-white items-center justify-center">墙</span>
          校园墙
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-slate-600 hover:text-brand-600 no-underline">首页</Link>
          {user && <Link href="/new" className="text-slate-600 hover:text-brand-600 no-underline">发布</Link>}

          {loading ? (
            <span className="text-slate-400">…</span>
          ) : user ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Link href="/admin" className="text-brand-600 no-underline">管理后台</Link>
              )}
              <Link href="/profile" className="text-slate-600 hover:text-brand-600 no-underline">
                {user.nickname}
              </Link>
              <button onClick={logout} className="btn-ghost text-xs px-3 py-1.5">退出</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-slate-600 hover:text-brand-600 no-underline">登录</Link>
              <Link href="/register" className="btn-primary text-xs px-3 py-1.5 no-underline">注册</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
