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

  if (loading) return <div className="p-4 text-center text-gray-400">加载中…</div>;

  return (
    <div className="space-y-4 -mx-4">
      <h1 className="text-xl font-bold text-gray-900 px-4 pt-1">快捷通道</h1>
      {links.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-400">
          <p className="text-4xl mb-2">🔗</p>
          <p className="text-sm">暂无快捷通道</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 px-4">
          {links.map(link => (
            <Link
              key={link.id}
              href={link.url}
              target="_blank"
              onClick={() => handleClick(link)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-sm hover:shadow-md transition"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl overflow-hidden">
                {link.icon ? (
                  <img src={link.icon} alt="" className="h-full w-full object-cover" />
                ) : (
                  link.title[0]
                )}
              </div>
              <span className="text-xs text-gray-700 text-center line-clamp-1">{link.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
