import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';

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
          <main className="mx-auto px-4 pt-3 pb-24 min-h-[calc(100vh-56px)]" style={{ maxWidth: 640 }}>
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
