'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Wish {
  id: string;
  itemName: string;
  description: string;
  image?: string | null;
  status: string;
  createdAt: string;
  user: { nickname: string };
}

export function WishView({ onBack }: { onBack: () => void }) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get<{ wishes: Wish[] }>('/api/wishes?mine=1&limit=50')
      .then(d => setWishes(d.wishes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusBadge = (s: string) => {
    if (s === 'ADOPTED') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">已采纳</span>;
    if (s === 'REVIEWED') return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">已查看</span>;
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600">待查看</span>;
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>

      <div>
        <h2 className="text-xl font-bold text-gray-900">🎯 我的许愿</h2>
        <p className="text-sm text-gray-400 mt-1">在这里查看你提交过的许愿记录</p>
      </div>

      {/* 许愿列表 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
          <p className="mt-3 text-sm text-gray-400">加载中…</p>
        </div>
      ) : wishes.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-10 text-center">
          <p className="text-5xl mb-3">🎯</p>
          <p className="text-gray-500 text-sm mb-1">你还没有许过愿</p>
          <p className="text-gray-400 text-xs">去「积分商城」点击「我要许愿」提交吧~</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wishes.map(w => (
            <div key={w.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="flex gap-3 p-4">
                {w.image && (
                  <img src={w.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">{w.itemName}</span>
                    {statusBadge(w.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{w.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <span>{new Date(w.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
