'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  SYSTEM: '系统', POST: '帖子', COMMENT: '评论', LIKE: '点赞', ANNOUNCE: '公告',
};
const TYPE_COLOR: Record<string, string> = {
  SYSTEM: 'bg-blue-100 text-blue-700',
  POST: 'bg-purple-100 text-purple-700',
  COMMENT: 'bg-green-100 text-green-700',
  LIKE: 'bg-red-100 text-red-700',
  ANNOUNCE: 'bg-amber-100 text-amber-700',
};

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return d.toLocaleDateString('zh-CN');
  } catch { return iso; }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/notifications?page=${page}&pageSize=${pageSize}`)
      .then((d: any) => { setItems(d.items); setTotal(d.total); })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setItems(items.map(i => i.id === id ? { ...i, isRead: true } : i));
    } catch (e) { console.error(e); }
  };

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all', {});
      setItems(items.map(i => ({ ...i, isRead: true })));
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">通知中心</h1>
        <button onClick={markAll} className="text-sm text-blue-500 hover:text-blue-600">全部已读</button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          暂无通知
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id} className={`bg-white rounded-2xl p-4 shadow-sm ${!n.isRead ? 'border-l-4 border-blue-500' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLOR[n.type] || 'bg-gray-100'}`}>{TYPE_LABEL[n.type] || n.type}</span>
                    <span className="font-semibold text-slate-900 text-sm">{n.title}</span>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-1.5 text-xs text-slate-400">{fmtTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} className="shrink-0 text-xs text-slate-400 hover:text-blue-500">标为已读</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">上一页</button>
          <span className="text-sm text-slate-500">第 {page} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}
