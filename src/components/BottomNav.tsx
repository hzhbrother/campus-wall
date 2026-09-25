'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* 悬浮发布按钮 */}
      <Link
        href="/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition"
        style={{ right: 'calc(50% - 320px + 1rem)' }}
        aria-label="发布"
      >
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </Link>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-100 bg-white">
        <div className="mx-auto flex items-center justify-around h-16" style={{ maxWidth: 640 }}>
          <Link href="/" className={`flex flex-col items-center gap-0.5 no-underline ${isActive('/') ? 'text-blue-500' : 'text-slate-400'}`}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5Z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs">首页</span>
          </Link>

          <span className="flex flex-col items-center gap-0.5 text-slate-400 cursor-not-allowed">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs">消息</span>
          </span>

          <Link href={user ? '/profile' : '/login'} className={`flex flex-col items-center gap-0.5 no-underline ${pathname?.startsWith('/profile') ? 'text-blue-500' : 'text-slate-400'}`}>
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs">我的</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
