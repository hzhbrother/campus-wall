'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePageRefresh } from '@/lib/use-page-refresh';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { formatUserCode } from '@/lib/user-number';
import { compressImage } from '@/lib/image-compress';

interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  coverImage: string | null;
  role: string;
  verified: boolean;
  qualificationType: string | null;
  qualificationVerified: boolean;
  points: number;
  userNumber: number | null;
  school: { id: string; name: string } | null;
  organization: { id: string; name: string } | null;
  createdAt: string;
  qualifications: { id: string; type: string; category: string; verifiedAt: string | null; photo: string | null; photo2: string | null; displayPhoto: string | null }[];
  followsPublic?: boolean; // 仅本人可见
  // 头像审核状态: PENDING / APPROVED / REJECTED
  avatarStatus?: string | null;
  _count: { posts: number; comments: number; favorites: number; likesReceived: number; follows: number; followers: number };
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
  const [tab, setTab] = useState<'posts' | 'likes' | 'favorites' | 'comments'>('posts');
  // 封面上传弹窗
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverSubmitting, setCoverSubmitting] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  // 正在更新个人资料 (封面等): 期间阻止 onFocus 触发的 loadAll, 避免旧数据竞态覆盖
  const updatingRef = useRef(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [lightboxBadge, setLightboxBadge] = useState<{ imageUrl: string | null; icon: string | null; name: string; description: string | null } | null>(null);
  const [badges, setBadges] = useState<{ badge: { id: string; name: string; icon: string | null; description: string | null; imageUrl: string | null }; earnedAt: string }[]>([]);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followsPublicBusy, setFollowsPublicBusy] = useState(false);
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
    // 正在更新资料时, 跳过刷新 (避免 onFocus 触发的旧数据覆盖刚更新的数据)
    if (updatingRef.current) return;
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

  // 非本人主页: 加载自己关注列表, 判断是否已关注该用户
  useEffect(() => {
    if (!me?.id || isOwn || !userId) return;
    let cancelled = false;
    api.get<{ items: { id: string }[] }>(`/api/users/me/follow?page=1&pageSize=200`)
      .then(d => {
        if (cancelled) return;
        const list = d.items || [];
        setFollowing(list.some(it => it.id === userId));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [me?.id, isOwn, userId]);

  // 关注/取消关注
  const toggleFollow = async () => {
    if (followBusy || !userId) return;
    setFollowBusy(true);
    try {
      if (following) {
        await api.del(`/api/users/me/follow/${userId}`);
        setFollowing(false);
      } else {
        await api.post('/api/users/me/follow', { userId });
        setFollowing(true);
      }
    } catch (e: any) {
      alert(e.message || '操作失败');
    } finally {
      setFollowBusy(false);
    }
  };

  // 切换关注列表公开/隐藏 (乐观更新)
  const toggleFollowsPublic = async () => {
    if (followsPublicBusy || !profile) return;
    const prev = profile.followsPublic;
    setProfile(p => p ? { ...p, followsPublic: !prev } : p);
    setFollowsPublicBusy(true);
    try {
      await api.patch('/api/users/me', { followsPublic: !prev });
    } catch (e: any) {
      // 回滚
      setProfile(p => p ? { ...p, followsPublic: prev } : p);
      alert(e.message || '更新失败');
    } finally {
      setFollowsPublicBusy(false);
    }
  };

  // 墙龄: 从注册日到今天的天数 (now 每日 0 点自动刷新)
  const wallDays = profile
    ? Math.max(1, Math.floor((now - new Date(profile.createdAt).getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 0;

  // 打开封面上传弹窗
  const openCoverModal = () => {
    setCoverPreview(profile?.coverImage || '');
    setCoverUrl(profile?.coverImage || '');
    setShowCoverModal(true);
  };

  // 弹窗内: 选择本地图片 (压缩到 1280px, 仅预览, 不立即上传)
  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const dataUrl = await compressImage(file, 1280, 0.75);
      setCoverPreview(dataUrl);
      setCoverUrl(dataUrl);
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  };

  // 弹窗内: 粘贴 URL 后失焦生效
  const handleCoverUrlSave = () => {
    setCoverPreview(coverUrl.trim());
  };

  // 弹窗内: 移除封面
  const handleCoverRemove = () => {
    setCoverPreview('');
    setCoverUrl('');
  };

  // 弹窗内: 提交封面 (直接上传, 无需审核)
  const handleCoverSubmit = async () => {
    setCoverSubmitting(true);
    updatingRef.current = true;
    try {
      // 空字符串表示移除封面
      await api.patch('/api/users/me', { coverImage: coverPreview || null });
      setShowCoverModal(false);
      updatingRef.current = false;
      await loadAll();
    } catch (e: any) {
      alert(e.message || '封面更新失败');
    } finally {
      setCoverSubmitting(false);
      updatingRef.current = false;
    }
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
          /* 右上角编辑按钮: 始终可见, 点击打开封面上传弹窗 */
          <button
            type="button"
            onClick={openCoverModal}
            className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm transition hover:bg-black/70"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {profile.coverImage ? '更换封面' : '添加封面'}
          </button>
        )}
      </div>

      {/* 用户信息卡片 (上移覆盖封面) */}
      <div className="relative -mt-10 rounded-t-3xl bg-white px-4 pt-4 pb-5 shadow-sm">
        <div className="flex items-end gap-3">
          {/* 头像 (点击放大) */}
          <div className="flex flex-col items-center">
            <button onClick={() => profile.avatar && setShowAvatarLightbox(true)} className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 ring-4 ring-white flex items-center justify-center text-white text-xl font-bold">
              {profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : (profile.nickname || 'U')[0].toUpperCase()}
            </button>
            {/* 头像审核中: 显示橙色"头像审核中"小标签 */}
            {profile.avatarStatus === 'PENDING' && (
              <span className="mt-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-600">头像审核中</span>
            )}
          </div>
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
              onClick={toggleFollow}
              disabled={followBusy}
              className={`mb-1 rounded-full border px-3.5 py-1 text-sm transition disabled:opacity-50 ${
                following
                  ? 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {following ? '✓ 已关注' : '+ 关注'}
            </button>
          )}
        </div>

        {/* 标签行: 学校/团体 / 年级 / 班级 / 墙龄 / 资质认证 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {profile.school && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-600">🏫 {profile.school.name}</span>
          )}
          {profile.organization && (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-600">👥 {profile.organization.name}</span>
          )}
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-500">墙龄 {wallDays} 天</span>
          {/* 已通过的资质认证标签 (实时动态) */}
          {profile.qualifications?.filter((q: any) => q.category === 'QUALIFICATION').map((q: any) => (
            <span key={q.id} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {q.type}
            </span>
          ))}
          {/* 兼容旧字段: 单个资质认证 */}
          {profile.qualificationVerified && profile.qualificationType && !profile.qualifications?.some((q: any) => q.type === profile.qualificationType) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {profile.qualificationType}
            </span>
          )}
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

        {/* 关注 / 粉丝 统计 — 可点击跳转列表 */}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs">
          <Link
            href={`/users/${userId}/follows?type=following`}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-500"
          >
            <span className="font-bold text-gray-900">{counts.follows ?? 0}</span>
            <span>关注</span>
          </Link>
          <span className="text-gray-200">|</span>
          <Link
            href={`/users/${userId}/follows?type=followers`}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-500"
          >
            <span className="font-bold text-gray-900">{counts.followers ?? 0}</span>
            <span>粉丝</span>
          </Link>
        </div>

        {/* 关注列表隐私开关 (仅本人可见) */}
        {isOwn && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>我的关注列表：</span>
            <button
              onClick={toggleFollowsPublic}
              disabled={followsPublicBusy}
              className={`rounded-full border px-2.5 py-0.5 transition disabled:opacity-50 ${
                profile.followsPublic
                  ? 'border-blue-300 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              {profile.followsPublic ? '公开' : '仅自己可见'}
            </button>
          </div>
        )}
      </div>

      {/* 头像放大灯箱 */}
      {showAvatarLightbox && profile.avatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowAvatarLightbox(false)}>
          <img src={profile.avatar} alt="" className="max-h-[80vh] max-w-[90vw] rounded-xl" />
        </div>
      )}

      {/* 荣誉认证 (证书) / 资质认证 / 勋章 */}
      {((profile.qualifications?.length ?? 0) > 0 || profile.qualificationVerified || badges.length > 0) && (
        <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm space-y-4">
          {/* 荣誉认证 (证书类, 以图片形式展示, 可点击放大) */}
          {(profile.qualifications?.filter((q: any) => q.category === 'HONOR').length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">📜 荣誉证书</h3>
              <div className="grid grid-cols-3 gap-2">
                {profile.qualifications!.filter((q: any) => q.category === 'HONOR').map((q: any) => {
                  const displayPhoto = q.displayPhoto === 'photo2' ? q.photo2 : (q.photo || q.photo2);
                  return (
                    <Link
                      key={q.id}
                      href={`/users/${userId}/qualifications/${q.id}`}
                      className="relative block rounded-xl border border-gray-100 overflow-hidden no-underline transition hover:border-amber-200 hover:shadow-sm"
                    >
                      {/* 右上角: 点击查看详情 */}
                      <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="7" />
                          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
                        </svg>
                        详情
                      </span>
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-50">
                        <span className="text-amber-600 text-xs">🏆</span>
                        <span className="text-xs font-medium text-gray-800 truncate">{q.type}</span>
                      </div>
                      {displayPhoto ? (
                        <div className="block w-full bg-gray-50 transition-colors hover:bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={displayPhoto} alt={q.type} className="w-full aspect-[3/4] object-cover" />
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-gray-400">暂无证书图片</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* 证书/勋章 (badges) */}
          {badges.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">🎖️ 证书/徽章</h3>
              <div className="grid grid-cols-4 gap-3">
                {badges.map(ub => (
                  <button
                    key={ub.badge.id}
                    onClick={() => setLightboxBadge({ imageUrl: ub.badge.imageUrl || null, icon: ub.badge.icon, name: ub.badge.name, description: ub.badge.description })}
                    className="flex flex-col items-center text-center"
                  >
                    {ub.badge.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={ub.badge.imageUrl} alt={ub.badge.name} className="h-12 w-12 object-contain hover:scale-110 transition-transform" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center text-2xl hover:scale-110 transition-transform">
                        {ub.badge.icon || '🏅'}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-gray-600 line-clamp-1">{ub.badge.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 勋章放大灯箱 */}
      {lightboxBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightboxBadge(null)}>
          <div className="flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {lightboxBadge.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={lightboxBadge.imageUrl} alt={lightboxBadge.name} className="h-32 w-32 object-contain drop-shadow-lg" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center text-7xl">
                {lightboxBadge.icon || '🏅'}
              </div>
            )}
            <div className="mt-4 text-xl font-bold text-white">{lightboxBadge.name}</div>
            {lightboxBadge.description && (
              <div className="mt-2 text-sm text-white/70 max-w-xs text-center">{lightboxBadge.description}</div>
            )}
            <button onClick={() => setLightboxBadge(null)} className="mt-6 rounded-full bg-white/20 px-5 py-2 text-sm text-white hover:bg-white/30">关闭</button>
          </div>
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

      {/* 封面上传弹窗 */}
      {showCoverModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setShowCoverModal(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">封面图</h3>
              {coverPreview && (
                <button onClick={handleCoverRemove} className="text-xs text-red-500 hover:underline">移除封面</button>
              )}
            </div>
            {/* 预览 */}
            {coverPreview ? (
              <div className="mb-3 h-32 w-full overflow-hidden rounded-xl border border-gray-200">
                <img src={coverPreview} alt="封面预览" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="mb-3 flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
                暂无封面
              </div>
            )}
            {/* URL 输入 + 上传按钮 */}
            <div className="flex gap-2">
              <input
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                onBlur={handleCoverUrlSave}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="粘贴封面图片 URL, 失焦后生效"
              />
              <label className={`cursor-pointer rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600 hover:bg-blue-100 ${coverUploading ? 'opacity-50' : ''}`}>
                {coverUploading ? '上传中…' : '上传图片'}
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">上传图片会自动压缩到 1280px, 提交后直接生效</p>
            {/* 提交 / 取消 */}
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleCoverSubmit}
                disabled={coverSubmitting}
                className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {coverSubmitting ? '提交中…' : '提交'}
              </button>
              <button
                onClick={() => setShowCoverModal(false)}
                className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
