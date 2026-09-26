import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { SiteFooter } from '@/components/SiteFooter';

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
          <main className="mx-auto px-4 pt-3 pb-24 min-h-[calc(100vh-56px)] max-w-[640px] md:max-w-4xl lg:max-w-5xl">
            {children}
            <SiteFooter />
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
