'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface QuickLink {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  clickCount: number;
}

// 图标背景渐变色板 (循环使用)
const ICON_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-rose-400 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-violet-400 to-purple-500',
  'from-cyan-400 to-sky-500',
  'from-fuchsia-400 to-pink-500',
  'from-lime-400 to-green-500',
];

export default function QuickLinksPage() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ items: QuickLink[] }>('/api/quick-links')
      .then(d => setLinks(d.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClick = (link: QuickLink) => {
    api.post(`/api/quick-links/${link.id}/click`, {}).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
        <p className="mt-3 text-sm text-gray-400">加载中…</p>
      </div>
    );
  }

  return (
    <div className="-mx-4">
      {/* 顶部渐变横幅 */}
      <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 px-4 pt-4 pb-8">
        <h1 className="text-2xl font-bold text-white">快捷通道</h1>
        <p className="text-blue-100 text-sm mt-1">常用服务一键直达</p>
      </div>

      <div className="px-4 pt-5">
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🔗</div>
            <p className="text-sm">暂无快捷通道</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-y-5 gap-x-2">
            {links.map((link, idx) => (
              <Link
                key={link.id}
                href={link.url}
                target="_blank"
                onClick={() => handleClick(link)}
                className="group flex flex-col items-center gap-2"
              >
                <div className={`relative h-14 w-14 rounded-2xl bg-gradient-to-br ${ICON_GRADIENTS[idx % ICON_GRADIENTS.length]} flex items-center justify-center text-white text-2xl shadow-md overflow-hidden transition group-hover:scale-110 group-hover:shadow-lg`}>
                  {link.icon ? (
                    <img src={link.icon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    link.title[0]
                  )}
                </div>
                <span className="text-xs text-gray-700 text-center line-clamp-1 max-w-[64px]">{link.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
