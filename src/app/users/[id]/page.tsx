'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  coverImage: string | null;
  role: string;
  grade: string | null;
  className: string | null;
  createdAt: string;
  _count: { posts: number; comments: number; likesReceived: number };
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

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  post: { id: string; title: string };
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuth();
  const userId = params?.id as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'posts' | 'comments'>('posts');
  const [savingCover, setSavingCover] = useState(false);

  const isOwn = me?.id === userId;

  useEffect(() => {
    if (!userId) return;
    setLoading(true); setErr('');
    Promise.all([
      api.get<UserProfile>(`/api/users/${userId}`).catch(e => { setErr(e.message); return null; }),
      api.get<{ items: Post[] }>(`/api/posts?authorId=${userId}&pageSize=50`).then(d => d.items).catch(() => []),
      api.get<{ items: Comment[] }>(`/api/comments?authorId=${userId}`).then(d => d.items).catch(() => []),
    ]).then(([u, p, c]) => {
      setProfile(u);
      setPosts(p);
      setComments(c);
    }).finally(() => setLoading(false));
  }, [userId]);

  // 墙龄: 从注册日到今天的天数
  const wallDays = profile
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 0;

  // 更换封面
  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setSavingCover(true);
      try {
        await api.patch('/api/users/me', { coverImage: dataUrl });
        setProfile(p => p ? { ...p, coverImage: dataUrl } : p);
      } catch (e: any) {
        alert(e.message || '封面更新失败');
      } finally {
        setSavingCover(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="py-12 text-center text-gray-400">加载中…</div>;
  if (err || !profile) return (
    <div className="py-12 text-center">
      <p className="text-gray-500">{err || '用户不存在'}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-blue-500">返回</button>
    </div>
  );

  const counts = profile._count;

  return (
    <div className="space-y-0">
      {/* 顶部封面 */}
      <div className="relative -mx-4 -mt-3 h-44 overflow-hidden">
        {profile.coverImage ? (
          <img src={profile.coverImage} alt="封面" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-blue-500 to-blue-400" />
        )}
        {isOwn && (
          <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 bg-black/20 text-white/90 transition hover:bg-black/30">
            {savingCover ? (
              <span className="text-sm">上传中…</span>
            ) : (
              <>
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm">点击更换封面</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
          </label>
        )}
      </div>

      {/* 用户信息卡片 (上移覆盖封面) */}
      <div className="relative -mt-10 rounded-t-3xl bg-white px-4 pt-4 pb-5 shadow-sm">
        <div className="flex items-end gap-3">
          {/* 头像 */}
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 ring-4 ring-white flex items-center justify-center text-white text-xl font-bold">
            {profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : (profile.nickname || 'U')[0].toUpperCase()}
          </div>
          {/* 昵称 + 编辑按钮 */}
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-gray-900">{profile.nickname}</span>
            </div>
          </div>
          {isOwn ? (
            <Link
              href="/profile?edit=1"
              className="mb-1 rounded-full border border-gray-200 px-3.5 py-1 text-sm text-gray-600 hover:bg-gray-50"
            >
              编辑资料
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              className="mb-1 rounded-full border border-gray-200 px-3.5 py-1 text-sm text-gray-600 hover:bg-gray-50"
            >
              返回
            </button>
          )}
        </div>

        {/* 标签行: 年级 / 班级 / 认证 / 墙龄 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {profile.grade && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{profile.grade}</span>
          )}
          {profile.className && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{profile.className}</span>
          )}
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-400">未认证</span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-500">墙龄 {wallDays} 天</span>
        </div>

        {/* 获赞统计 */}
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">{counts.likesReceived}</span>
            <span className="text-sm text-gray-400">获赞</span>
          </div>
        </div>
      </div>

      {/* 帖子 / 评论 Tab */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex">
          {(['posts', 'comments'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 py-3 text-center text-base ${tab === t ? 'text-blue-500 font-medium' : 'text-gray-400'}`}
            >
              {t === 'posts' ? `帖子 ${counts.posts}` : `评论 ${counts.comments}`}
              {tab === t && <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="bg-gray-50 min-h-[200px]">
        {tab === 'posts' ? (
          posts.length === 0 ? (
            <div className="py-16 text-center text-gray-400">还没有发布过帖子</div>
          ) : (
            <div className="space-y-2 p-3">
              {posts.map(p => (
                <Link key={p.id} href={`/post/${p.id}`} className="block rounded-xl bg-white p-3 hover:bg-gray-50 no-underline">
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
          )
        ) : (
          comments.length === 0 ? (
            <div className="py-16 text-center text-gray-400">还没有发表过评论</div>
          ) : (
            <div className="space-y-2 p-3">
              {comments.map(c => (
                <Link key={c.id} href={`/post/${c.post.id}`} className="block rounded-xl bg-white p-3 hover:bg-gray-50 no-underline">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">评论于《{c.post.title}》</span>
                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-gray-700 line-clamp-2">{c.content}</p>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
