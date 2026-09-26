'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePageRefresh } from '@/lib/use-page-refresh';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  pinned?: boolean;
  link?: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  SYSTEM: '系统', POST: '帖子', COMMENT: '评论', LIKE: '点赞', ANNOUNCE: '公告', BAN: '封禁',
};
const TYPE_COLOR: Record<string, string> = {
  SYSTEM: 'bg-blue-100 text-blue-700',
  POST: 'bg-purple-100 text-purple-700',
  COMMENT: 'bg-green-100 text-green-700',
  LIKE: 'bg-red-100 text-red-700',
  ANNOUNCE: 'bg-amber-100 text-amber-700',
  BAN: 'bg-red-100 text-red-700',
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
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'unread' | 'all'>('unread');
  const [unreadCount, setUnreadCount] = useState(0);
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (tab === 'unread') params.set('unread', '1');
    api.get(`/api/notifications?${params.toString()}`)
      .then((d: any) => { setItems(d.items); setTotal(d.total); })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [page, tab]);

  // 获取未读总数
  const refreshUnread = useCallback(() => {
    api.get<{ count: number }>('/api/notifications/unread-count')
      .then(d => setUnreadCount(d.count))
      .catch(() => {});
  }, []);

  // 全量刷新: 通知列表 + 未读数
  const refreshAll = useCallback(() => {
    load();
    refreshUnread();
  }, [load, refreshUnread]);

  // 挂载 + 标签页激活时刷新
  usePageRefresh(refreshAll, [refreshAll]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  // 切换标签时重置页码
  const switchTab = (t: 'unread' | 'all') => { setTab(t); setPage(1); };

  const markRead = async (id: string) => {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setItems(items.map(i => i.id === id ? { ...i, isRead: true } : i));
      if (tab === 'unread') setItems(items.filter(i => i.id !== id));
      refreshUnread();
    } catch (e) { console.error(e); }
  };

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all', {});
      if (tab === 'unread') setItems([]);
      else setItems(items.map(i => ({ ...i, isRead: true })));
      refreshUnread();
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">消息中心</h1>
        {/* 未读标签下显示全部已读按钮; 全部标签下显示未读数量 */}
        {tab === 'unread' ? (
          <button onClick={markAll} className="text-sm text-blue-500 hover:text-blue-600">全部已读</button>
        ) : (
          <span className="text-sm text-slate-400">未读 {unreadCount} 条</span>
        )}
      </div>

      {/* 标签切换 */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => switchTab('unread')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
          }`}
        >
          未读 {unreadCount > 0 && <span className="text-red-500">({unreadCount})</span>}
        </button>
        <button
          onClick={() => switchTab('all')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
          }`}
        >
          全部
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          {tab === 'unread' ? '暂无未读消息' : '暂无消息'}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-2xl p-4 shadow-sm ${!n.isRead ? 'border-l-4 border-blue-500' : ''} ${n.link ? 'cursor-pointer hover:bg-slate-50' : ''} ${n.pinned ? 'ring-2 ring-amber-300' : ''}`}
              onClick={() => { if (n.link) { markRead(n.id); router.push(n.link); } }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.pinned && <span className="text-amber-500 text-xs">📌</span>}
                    <span className={`rounded px-1.5 py-0.5 text-xs ${TYPE_COLOR[n.type] || 'bg-gray-100'}`}>{TYPE_LABEL[n.type] || n.type}</span>
                    <span className="font-semibold text-slate-900 text-sm">{n.title}</span>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-1.5 text-xs text-slate-400">{fmtTime(n.createdAt)}</p>
                  {n.link && <p className="mt-1 text-xs text-blue-500">点击查看 →</p>}
                </div>
                {!n.isRead && (
                  <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }} className="shrink-0 text-xs text-slate-400 hover:text-blue-500">标为已读</button>
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
