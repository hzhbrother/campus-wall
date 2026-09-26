'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PostCard, PostListItem } from '@/components/PostCard';
import { usePageRefresh } from '@/lib/use-page-refresh';

const DEFAULT_CATEGORIES = ['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答'];

export default function HomePage() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [hotItems, setHotItems] = useState<PostListItem[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [announcement, setAnnouncement] = useState('欢迎来到校园墙！请文明发言，禁止发布违规内容。失物招领请尽量附上图片，二手交易请当面验货。');
  const [category, setCategory] = useState<string>('');
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q) params.set('q', q);
      const res = await api.get<{ items: PostListItem[] }>(`/api/posts?${params.toString()}`);
      setItems(res.items);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [category, q]);

  // 全量刷新: 帖子 + 热榜 + 分类 + 公告
  const refreshAll = useCallback(() => {
    load();
    api.get<{ items: PostListItem[] }>('/api/posts?sort=hot&pageSize=5')
      .then(d => setHotItems(d.items))
      .catch(() => {});
    api.get<string[]>('/api/posts/categories')
      .then(cats => setCategories(cats.length ? cats : DEFAULT_CATEGORIES))
      .catch(() => {});
    api.get<Record<string, string>>('/api/site-config')
      .then(d => { if (d.announcement_text) setAnnouncement(d.announcement_text); })
      .catch(() => {});
  }, [load]);

  // 挂载 + 标签页激活时全量刷新
  usePageRefresh(refreshAll, [refreshAll]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      {/* 分类标签栏 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setCategory('')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
            !category ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'
          }`}
        >
          推荐
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c === category ? '' : c)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              c === category ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'
            }`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setSearchOpen(s => !s)}
          className="shrink-0 ml-auto p-2 rounded-full bg-white text-slate-500"
          aria-label="搜索"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 搜索框 */}
      {searchOpen && (
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            placeholder="搜索标题或内容…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            autoFocus
          />
          <button className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm" onClick={load}>搜索</button>
        </div>
      )}

      {/* 今日热榜 */}
      {hotItems.length > 0 && (
        <div className="rounded-2xl bg-white p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-sm font-bold text-orange-500">🔥 今日热榜</span>
          </div>
          <div className="space-y-1.5">
            {hotItems.map((p, i) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="flex items-center gap-2 no-underline"
              >
                <span className={`w-5 text-center text-sm font-bold ${i < 3 ? 'text-orange-500' : 'text-slate-300'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-slate-700 hover:text-blue-500">
                  {p.title || p.content.slice(0, 30)}
                </span>
                <span className="shrink-0 text-xs text-slate-300">
                  {p.likeCount > 0 ? `👍 ${p.likeCount}` : `${p.commentCount}评`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 滚动公告栏 */}
      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 overflow-hidden">
        <span className="shrink-0">📢</span>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="marquee inline-block">
            {announcement}
          </div>
        </div>
      </div>

      {/* 信息流 */}
      {loading ? (
        <p className="text-center text-slate-400 py-10">加载中…</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400">
          暂无内容。{q || category ? '换个筛选试试' : <>先去<Link href="/new" className="text-brand-600">发布第一条</Link>吧</>}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
