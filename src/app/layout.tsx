import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: '校园墙',
  description: '校园信息交流平台 - 失物招领/二手交易/表白墙/寻物启事',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <Header />
          <main className="max-w-3xl mx-auto px-4 py-6 min-h-[calc(100vh-64px)]">{children}</main>
          <footer className="border-t border-slate-200 text-center text-xs text-slate-400 py-6">
            校园墙 · 仅供学习交流
          </footer>
        </Providers>
      </body>
    </html>
  );
}
