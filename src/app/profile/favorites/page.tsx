'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePageRefresh } from '@/lib/use-page-refresh';

interface FavPost {
  id: string;
  title: string;
  content: string;
  category: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

interface Favorite {
  id: string;
  createdAt: string;
  post: FavPost;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    api.get<{ items: Favorite[] }>('/api/favorites')
      .then(d => setItems(d.items))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  usePageRefresh(load, []);
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">我的收藏</h1>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中…</div>
      ) : err ? (
        <div className="py-12 text-center text-red-500">{err}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-gray-400">还没有收藏的帖子</div>
      ) : (
        <div className="space-y-2">
          {items.map(f => (
            <Link key={f.id} href={`/post/${f.post.id}`} className="block rounded-2xl bg-white p-4 shadow-sm hover:bg-gray-50 no-underline">
              <div className="flex items-center justify-between">
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{f.post.category}</span>
                <span className="text-xs text-gray-400">{new Date(f.post.createdAt).toLocaleDateString()}</span>
              </div>
              <h3 className="mt-1.5 font-medium text-gray-900 line-clamp-1">{f.post.title}</h3>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{f.post.content}</p>
              <div className="mt-2 flex gap-4 text-xs text-gray-400">
                <span>❤ {f.post.likeCount}</span>
                <span>💬 {f.post.commentCount}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
