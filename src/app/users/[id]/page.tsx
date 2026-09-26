'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePageRefresh } from '@/lib/use-page-refresh';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  coverImage: string | null;
  role: string;
  grade: string | null;
  className: string | null;
  verified: boolean;
  qualificationType: string | null;
  qualificationVerified: boolean;
  points: number;
  userNumber: number | null;
  createdAt: string;
  _count: { posts: number; comments: number; favorites: number; likesReceived: number };
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

// 用户编号展示: 未认证=XYS, 已认证=XY
function formatUserCode(userNumber: number | null | undefined, verified: boolean): string {
  if (userNumber == null) return '';
  const prefix = verified ? 'XY' : 'XYS';
  const padded = userNumber >= 100000001 ? String(userNumber) : String(userNumber).padStart(5, '0');
  return `${prefix}${padded}`;
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
  const [tab, setTab] = useState<'posts' | 'likes' | 'favorites' | 'comments'>('posts');
  const [savingCover, setSavingCover] = useState(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [badges, setBadges] = useState<{ badge: { id: string; name: string; icon: string | null; description: string | null }; earnedAt: string }[]>([]);
  // 墙龄自动刷新: 每天 0 点更新一次 now, 触发重新计算天数
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const tick = () => {
      setNow(Date.now());
      // 计算到下一个 0 点的毫秒数
      const next = new Date();
      next.setHours(24, 0, 0, 0);
      timer = setTimeout(tick, next.getTime() - Date.now());
    };
    const next = new Date();
    next.setHours(24, 0, 0, 0);
    timer = setTimeout(tick, next.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, []);

  const isOwn = me?.id === userId;

  const loadAll = useCallback(() => {
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
      // 加载勋章
      api.get<{ items: any[] }>(`/api/users/${userId}/badges`)
        .then(d => setBadges(d.items || []))
        .catch(() => setBadges([]));
    }).finally(() => setLoading(false));
  }, [userId]);

  // 挂载 + 标签页激活时刷新
  usePageRefresh(loadAll, [loadAll]);
  useEffect(() => { loadAll(); }, [loadAll]);

  // 墙龄: 从注册日到今天的天数 (now 每日 0 点自动刷新)
  const wallDays = profile
    ? Math.max(1, Math.floor((now - new Date(profile.createdAt).getTime()) / (24 * 60 * 60 * 1000)) + 1)
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
          {/* 头像 (点击放大) */}
          <button onClick={() => profile.avatar && setShowAvatarLightbox(true)} className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 ring-4 ring-white flex items-center justify-center text-white text-xl font-bold">
            {profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : (profile.nickname || 'U')[0].toUpperCase()}
          </button>
          {/* 昵称 + 编辑按钮 */}
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-bold text-gray-900">{profile.nickname}</span>
              <VerifiedBadge verified={profile.verified} />
              {profile.qualificationVerified && profile.qualificationType && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-600">🏅 {profile.qualificationType}</span>
              )}
            </div>
            {(() => {
              const code = formatUserCode(profile.userNumber, profile.verified);
              if (!code) return null;
              return (
                <div className="mt-1 text-xs text-gray-400 tracking-wide">
                  <span className="text-gray-300">Nº</span> {code}
                </div>
              );
            })()}
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">🪙 {profile.points || 0} 积分</span>
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

        {/* 标签行: 年级 / 班级 / 墙龄 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {profile.grade && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{profile.grade}</span>
          )}
          {profile.className && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{profile.className}</span>
          )}
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-500">墙龄 {wallDays} 天</span>
        </div>

        {/* 统计: 帖子 / 获赞 / 收藏 / 评论 — 可点击切换内容 */}
        <div className="mt-4 grid grid-cols-4 border-t border-gray-100 pt-3">
          {([
            { key: 'posts', count: counts.posts, label: '帖子' },
            { key: 'likes', count: counts.likesReceived, label: '获赞' },
            { key: 'favorites', count: counts.favorites || 0, label: '收藏' },
            { key: 'comments', count: counts.comments, label: '评论' },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              className={`flex flex-col items-center py-1 transition ${tab === s.key ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
            >
              <span className={`text-lg font-bold ${tab === s.key ? 'text-blue-500' : 'text-gray-900'}`}>{s.count}</span>
              <span className={`text-xs ${tab === s.key ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 头像放大灯箱 */}
      {showAvatarLightbox && profile.avatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowAvatarLightbox(false)}>
          <img src={profile.avatar} alt="" className="max-h-[80vh] max-w-[90vw] rounded-xl" />
        </div>
      )}

      {/* 认证资质 / 荣誉勋章 */}
      {(profile.qualificationVerified || badges.length > 0) && (
        <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm">
          {profile.qualificationVerified && profile.qualificationType && (
            <div className="mb-3">
              <h3 className="text-sm font-bold text-gray-900 mb-2">📜 认证资质</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700">
                ✓ {profile.qualificationType}
              </span>
            </div>
          )}
          {badges.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">🏅 荣誉勋章</h3>
              <div className="grid grid-cols-4 gap-3">
                {badges.slice(0, 8).map(ub => (
                  <div key={ub.badge.id} className="flex flex-col items-center text-center">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl shadow-sm">
                      {ub.badge.icon || '🏅'}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600 line-clamp-1">{ub.badge.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 内容 (由统计行驱动) */}
      <div className="bg-gray-50 min-h-[200px]">
        {tab === 'posts' ? (
          posts.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-2 text-gray-400">
              <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm">还没有发布过帖子</span>
            </div>
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
        ) : tab === 'comments' ? (
          comments.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-2 text-gray-400">
              <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm">还没有发表过评论</span>
            </div>
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
        ) : (
          <div className="py-20 flex flex-col items-center gap-2 text-gray-400">
            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">
              {tab === 'likes' ? '该用户的获赞列表暂未公开' : '该用户的收藏列表暂未公开'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
