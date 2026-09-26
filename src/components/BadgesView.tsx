'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface UserBadge {
  id: string;
  badgeId: string;
  earnedAt: string;
  badge: { id: string; name: string; description?: string | null; icon?: string | null; conditionType: string; threshold: number };
}

export function BadgesView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ icon: string | null; name: string; description: string | null; earnedAt: string } | null>(null);

  useEffect(() => {
    api.get<{ items: UserBadge[] }>('/api/users/me/badges')
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-1">我的证书/勋章</h3>
        <p className="text-xs text-gray-400 mb-4">点击勋章可放大查看, 完成任务即可获得勋章, 彰显你的校园影响力</p>
        {loading ? (
          <p className="py-10 text-center text-gray-400">加载中…</p>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <div className="text-5xl mb-3">🏅</div>
            <p className="text-sm">还没有勋章, 快去发帖、签到获得吧~</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {items.map(ub => (
              <button
                key={ub.id}
                onClick={() => setLightbox({ icon: ub.badge.icon || null, name: ub.badge.name, description: ub.badge.description || null, earnedAt: ub.earnedAt })}
                className="flex flex-col items-center text-center"
              >
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-3xl shadow-lg shadow-amber-200 hover:scale-110 transition-transform">
                  {ub.badge.icon || '🏅'}
                </div>
                <div className="mt-2 text-sm font-medium text-gray-800">{ub.badge.name}</div>
                {ub.badge.description && <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{ub.badge.description}</div>}
                <div className="text-[11px] text-amber-600 mt-1">{new Date(ub.earnedAt).getFullYear()} 年获得</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 勋章放大灯箱 */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <div className="flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-7xl shadow-2xl">
              {lightbox.icon || '🏅'}
            </div>
            <div className="mt-4 text-xl font-bold text-white">{lightbox.name}</div>
            {lightbox.description && (
              <div className="mt-2 text-sm text-white/70 max-w-xs text-center">{lightbox.description}</div>
            )}
            <div className="mt-2 text-xs text-white/50">{new Date(lightbox.earnedAt).toLocaleDateString('zh-CN')} 获得</div>
            <button onClick={() => setLightbox(null)} className="mt-6 rounded-full bg-white/20 px-5 py-2 text-sm text-white hover:bg-white/30">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
