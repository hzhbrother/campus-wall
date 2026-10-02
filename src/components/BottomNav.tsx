'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white">
      <div className="relative mx-auto flex items-center justify-around h-16 max-w-[640px] md:max-w-4xl lg:max-w-5xl">
        <Link href="/" className={`flex flex-col items-center gap-0.5 no-underline ${isActive('/') ? 'text-blue-500' : 'text-slate-400'}`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5Z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs">首页</span>
        </Link>

        {/* 快捷通道 */}
        <Link href="/quick-links" className={`flex flex-col items-center gap-0.5 no-underline ${pathname?.startsWith('/quick-links') ? 'text-blue-500' : 'text-slate-400'}`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs">快捷通道</span>
        </Link>

        {/* 居中发帖大按钮 */}
        <Link
          href={user ? '/new' : '/login'}
          className="absolute left-1/2 -top-6 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition"
          aria-label="发帖"
        >
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </Link>
        <span className="absolute left-1/2 top-9 -translate-x-1/2 text-xs text-slate-400">发帖</span>

        {/* 积分商城 */}
        <Link href="/shop" className={`flex flex-col items-center gap-0.5 no-underline ${pathname?.startsWith('/shop') ? 'text-blue-500' : 'text-slate-400'}`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 6h18M16 10a4 4 0 0 1-8 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs">积分商城</span>
        </Link>

        <Link href={user ? '/profile' : '/login'} className={`flex flex-col items-center gap-0.5 no-underline ${pathname?.startsWith('/profile') ? 'text-blue-500' : 'text-slate-400'}`}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs">我的</span>
        </Link>
      </div>
    </nav>
  );
}
