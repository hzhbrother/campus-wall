'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  role: string;
  createdAt: string;
  _count: { posts: number };
}

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true); setErr('');
    Promise.all([
      api.get<UserProfile>(`/api/users/${userId}`).catch(e => { setErr(e.message); return null; }),
      api.get<{ items: Post[] }>(`/api/posts?authorId=${userId}&pageSize=50`).then(d => d.items).catch(() => []),
    ]).then(([u, p]) => {
      setProfile(u);
      setPosts(p);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="py-12 text-center text-gray-400">加载中…</div>;
  if (err || !profile) return (
    <div className="py-12 text-center">
      <p className="text-gray-500">{err || '用户不存在'}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-blue-500">返回</button>
    </div>
  );

  const roleLabel: Record<string, string> = { USER: '用户', STUDENT: '学生', TEACHER: '教师', ADMIN: '管理员', SUPER_ADMIN: '超级管理员' };

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="rounded-2xl bg-gradient-to-b from-blue-500 to-blue-400 p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-white/30 flex items-center justify-center text-2xl font-bold ring-4 ring-white/40">
            {profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : (profile.nickname || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold">{profile.nickname}</div>
            <div className="text-sm text-white/80">{roleLabel[profile.role] || profile.role}</div>
          </div>
        </div>
      </div>

      {/* 统计 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-xl font-bold text-purple-500">{profile._count.posts}</div><div className="text-xs text-gray-500">帖子</div></div>
          <div><div className="text-xl font-bold text-pink-500">{posts.length}</div><div className="text-xs text-gray-500">已展示</div></div>
          <div><div className="text-xl font-bold text-blue-500">{new Date(profile.createdAt).getFullYear()}</div><div className="text-xs text-gray-500">加入年份</div></div>
        </div>
      </div>

      {/* TA 的帖子 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold text-gray-900">TA 的帖子</h2>
        {posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">暂无帖子</p>
        ) : (
          <div className="space-y-3">
            {posts.map(p => (
              <Link key={p.id} href={`/post/${p.id}`} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50 no-underline">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{p.category}</span>
                  <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                <h3 className="mt-1.5 font-medium text-gray-900 line-clamp-1">{p.title}</h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{p.content}</p>
                <div className="mt-2 flex gap-4 text-xs text-gray-400">
                  <span>❤ {p.likeCount}</span>
                  <span>💬 {p.commentCount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
