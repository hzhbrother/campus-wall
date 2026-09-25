'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PostCard, PostListItem } from '@/components/PostCard';

const CATEGORIES = ['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答'];

export default function HomePage() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [category, setCategory] = useState<string>('');
  const [q, setQ] = useState('');
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

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* 搜索 */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="搜索标题或内容…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn-primary" onClick={load}>搜索</button>
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('')}
          className={`tag px-3 py-1 ${!category ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          全部
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c === category ? '' : c)}
            className={`tag px-3 py-1 ${c === category ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 信息流 */}
      {loading ? (
        <p className="text-center text-slate-400 py-10">加载中…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
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
