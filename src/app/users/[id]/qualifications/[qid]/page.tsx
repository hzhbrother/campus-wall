'use client';

// 奖状/资质详情页: 大图展示 + 可见性切换 + 评论 (含楼中楼)
// 路由: /users/[id]/qualifications/[qid]
//   id  = 所属用户 ID
//   qid = 资质 ID

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePageRefresh } from '@/lib/use-page-refresh';
import { VerifiedBadge } from '@/components/VerifiedBadge';

// 详情页可见性: PUBLIC(公开) / FOLLOWERS(仅粉丝可见) / PRIVATE(不公开, 仅自己)
type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

interface QualificationUser {
  id: string;
  nickname: string;
  avatar: string | null;
  verified: boolean;
}

interface QualificationDetail {
  id: string;
  type: string;            // 荣誉证书名称
  category: string;        // QUALIFICATION / HONOR
  photo: string | null;    // 正面图
  photo2: string | null;   // 反面图
  displayPhoto: string | null; // 公开展示哪一面: "photo" | "photo2"
  status: string;          // 审核状态
  verified: boolean;       // 是否已审核
  verifiedAt: string | null; // 颁发时间
  visibility: Visibility;  // 详情页可见性
  userId: string;
  user: QualificationUser;
  _count: { comments: number };
}

interface CommentAuthor {
  id: string;
  nickname: string;
  avatar: string | null;
  verified: boolean;
}

interface QualificationComment {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: CommentAuthor;
  replies?: QualificationComment[];
  _count?: { replies?: number };
}

interface CommentListResp {
  items: QualificationComment[];
  total?: number;
}

const VIS_OPTIONS: { value: Visibility; label: string; icon: string }[] = [
  { value: 'PUBLIC', label: '公开', icon: '🌍' },
  { value: 'FOLLOWERS', label: '仅粉丝可见', icon: '👥' },
  { value: 'PRIVATE', label: '不公开', icon: '🔒' },
];

// 楼中楼默认显示前 N 条回复
const REPLY_PREVIEW_COUNT = 3;

export default function QualificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuth();
  const userId = params?.id as string;
  const qid = params?.qid as string;

  const [detail, setDetail] = useState<QualificationDetail | null>(null);
  const [comments, setComments] = useState<QualificationComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // 403 类型: 'FOLLOWERS' | 'PRIVATE' | ''
  const [forbidden, setForbidden] = useState<Visibility | ''>('');

  // 图片放大灯箱
  const [lightbox, setLightbox] = useState<string | null>(null);

  // 可见性切换中
  const [visBusy, setVisBusy] = useState(false);

  // 评论输入
  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentErr, setCommentErr] = useState('');

  // 楼中楼回复: 当前正在回复的评论 ID + 输入内容
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  // 展开回复集合
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // 关注状态 (403 仅粉丝可见时引导关注)
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const isOwn = !!me && !!detail && me.id === detail.userId;

  // 加载详情
  const loadDetail = useCallback(async () => {
    if (!qid) return;
    try {
      const d = await api.get<QualificationDetail>(`/api/qualifications/${qid}`);
      setDetail(d);
      setForbidden('');
      setErr('');
    } catch (e: any) {
      const status = e?.status;
      if (status === 404) {
        setErr('奖状不存在或未通过审核');
      } else if (status === 403) {
        // 后端返回 visibility 字段以区分是「仅粉丝可见」还是「不公开」
        const vis = e?.data?.visibility as Visibility | undefined;
        setForbidden(vis || 'FOLLOWERS');
      } else {
        setErr(e?.message || '加载失败');
      }
    }
  }, [qid]);

  // 加载评论列表 (按时间正序)
  const loadComments = useCallback(async () => {
    if (!qid) return;
    try {
      const res = await api.get<CommentListResp>(
        `/api/qualifications/${qid}/comments?page=1&pageSize=50`,
      );
      const items = res.items || [];
      setComments(items);
      setCommentTotal(res.total ?? items.length);
    } catch {
      // 评论加载失败不阻塞页面
    }
  }, [qid]);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([loadDetail(), loadComments()]).finally(() => setLoading(false));
  }, [loadDetail, loadComments]);

  // 挂载 + 标签页激活时刷新
  usePageRefresh(loadAll, [loadAll]);

  // 403 仅粉丝可见: 加载自己关注列表判断是否已关注该用户
  useEffect(() => {
    if (!me?.id || !userId || isOwn || forbidden !== 'FOLLOWERS') return;
    let cancelled = false;
    api
      .get<{ items: { id: string }[] }>(`/api/users/me/follow?page=1&pageSize=200`)
      .then(d => {
        if (cancelled) return;
        const list = d.items || [];
        setFollowing(list.some(it => it.id === userId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me?.id, isOwn, userId, forbidden]);

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

  // 切换可见性 (乐观更新)
  const changeVisibility = async (vis: Visibility) => {
    if (!detail || visBusy || !isOwn || vis === detail.visibility) return;
    const prev = detail.visibility;
    setDetail(d => (d ? { ...d, visibility: vis } : d));
    setVisBusy(true);
    try {
      await api.patch(`/api/qualifications/${qid}`, { visibility: vis });
    } catch (e: any) {
      // 回滚
      setDetail(d => (d ? { ...d, visibility: prev } : d));
      alert(e.message || '更新失败');
    } finally {
      setVisBusy(false);
    }
  };

  // 发表评论
  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) {
      router.push('/login');
      return;
    }
    if (!comment.trim()) return;
    setCommentBusy(true);
    setCommentErr('');
    try {
      await api.post(`/api/qualifications/${qid}/comments`, {
        content: comment.trim(),
      });
      setComment('');
      await loadComments();
      // 同步详情中的评论计数
      setDetail(d =>
        d ? { ...d, _count: { ...d._count, comments: d._count.comments + 1 } } : d,
      );
    } catch (e: any) {
      if (e?.status === 403) setCommentErr('无评论权限');
      else setCommentErr(e?.message || '评论失败');
    } finally {
      setCommentBusy(false);
    }
  };

  // 回复评论
  const submitReply = async (parentId: string) => {
    if (!me) {
      router.push('/login');
      return;
    }
    if (!replyContent.trim()) return;
    setReplyBusy(true);
    try {
      await api.post(`/api/qualifications/${qid}/comments`, {
        content: replyContent.trim(),
        parentId,
      });
      setReplyContent('');
      setReplyToId(null);
      await loadComments();
    } catch (e: any) {
      if (e?.status === 403) alert('无评论权限');
      else alert(e?.message || '回复失败');
    } finally {
      setReplyBusy(false);
    }
  };

  // 展开/收起楼中楼回复
  const toggleExpandReplies = (id: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-400">加载中…</div>;
  }

  // 404 / 其他错误
  if (err) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">{err}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-blue-500"
        >
          返回
        </button>
      </div>
    );
  }

  // 403 无权访问
  if (forbidden) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">
          {forbidden === 'PRIVATE'
            ? '该奖状不公开, 仅作者可见'
            : '该奖状仅粉丝可见'}
        </p>
        {forbidden === 'FOLLOWERS' && !isOwn && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm text-gray-400">关注作者后即可查看</p>
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-50 ${
                following
                  ? 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {following ? '✓ 已关注' : '+ 关注'}
            </button>
          </div>
        )}
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-blue-500"
        >
          返回
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">奖状不存在</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-blue-500"
        >
          返回
        </button>
      </div>
    );
  }

  // 选定主展示图: 优先 displayPhoto 指定, 否则退到 photo / photo2
  const primaryPhoto =
    detail.displayPhoto === 'photo2'
      ? detail.photo2 || detail.photo
      : detail.displayPhoto === 'photo'
        ? detail.photo || detail.photo2
        : detail.photo || detail.photo2;
  const photos = [detail.photo, detail.photo2].filter(
    (p): p is string => !!p,
  );

  // 评论按时间正序
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {/* 顶部: 返回 + 标题 */}
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </button>
        <h1 className="flex-1 truncate text-lg font-bold text-gray-900">
          🏆 {detail.type}
        </h1>
        {detail.category === 'HONOR' && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
            荣誉
          </span>
        )}
      </div>

      {/* 奖状图片大图展示 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {primaryPhoto ? (
          <button
            onClick={() => setLightbox(primaryPhoto)}
            className="block w-full overflow-hidden rounded-xl bg-gray-50 transition-colors hover:bg-gray-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryPhoto}
              alt={detail.type}
              className="max-h-[60vh] w-full object-contain"
            />
            <div className="py-1.5 text-center text-xs text-gray-400">点击放大</div>
          </button>
        ) : (
          <div className="py-12 text-center text-sm text-gray-400">暂无证书图片</div>
        )}
        {/* 多图缩略图切换 */}
        {photos.length > 1 && (
          <div className="mt-3 flex gap-2">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setLightbox(p)}
                className={`overflow-hidden rounded-lg border-2 ${
                  p === primaryPhoto ? 'border-blue-500' : 'border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-14 w-14 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 元信息: 颁发时间 / 所属用户 */}
      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">所属用户</span>
          <Link
            href={`/users/${detail.user.id}`}
            className="flex items-center gap-1.5 no-underline"
          >
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-[10px] font-bold text-white">
              {detail.user.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={detail.user.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (detail.user.nickname || 'U')[0].toUpperCase()
              )}
            </div>
            <span className="text-sm font-medium text-gray-800 hover:text-blue-500">
              {detail.user.nickname}
            </span>
            <VerifiedBadge verified={!!detail.user.verified} />
          </Link>
        </div>
        {detail.verifiedAt && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">颁发时间</span>
            <span className="text-gray-700">
              {new Date(detail.verifiedAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        )}
      </div>

      {/* 可见性选择器 (仅 owner 可见) */}
      {isOwn && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs text-gray-400">详情页可见性</div>
          <div className="flex gap-2">
            {VIS_OPTIONS.map(opt => {
              const active = detail.visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => changeVisibility(opt.value)}
                  disabled={visBusy}
                  className={`flex-1 rounded-xl border px-2 py-2 text-sm transition disabled:opacity-50 ${
                    active
                      ? 'border-blue-500 bg-blue-50 font-medium text-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1">{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 评论区 */}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">评论 ({commentTotal})</h3>
          <span className="text-xs text-gray-400">按时间</span>
        </div>

        {/* 评论输入框 (需登录, 403 提示无评论权限) */}
        <form onSubmit={submitComment} className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder={me ? '写下你的评论…' : '请先登录后评论'}
            value={comment}
            onChange={e => setComment(e.target.value)}
            disabled={!me || commentBusy}
          />
          <button
            type="submit"
            disabled={!me || commentBusy || !comment.trim()}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {commentBusy ? '发送中…' : '发送'}
          </button>
        </form>
        {commentErr && <p className="text-xs text-red-500">{commentErr}</p>}

        {/* 评论列表 */}
        <div className="space-y-3">
          {sortedComments.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">还没有评论, 来抢沙发~</p>
          ) : (
            sortedComments.map(c => {
              const replies = c.replies || [];
              const expanded = expandedReplies.has(c.id);
              const shownReplies = expanded
                ? replies
                : replies.slice(0, REPLY_PREVIEW_COUNT);
              const hasMore = replies.length > REPLY_PREVIEW_COUNT;
              return (
                <div key={c.id} className="rounded-xl bg-gray-50/60 p-3">
                  {/* 评论主体 */}
                  <div className="mb-1 flex items-center gap-1.5">
                    <Link
                      href={`/users/${c.author.id}`}
                      className="flex items-center gap-1.5 no-underline"
                    >
                      <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-[10px] font-bold text-white">
                        {c.author.avatar ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={c.author.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (c.author.nickname || 'U')[0].toUpperCase()
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-800 hover:text-blue-500">
                        {c.author.nickname}
                      </span>
                    </Link>
                    <VerifiedBadge verified={!!c.author.verified} />
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap pl-1 text-sm text-gray-700">
                    {c.content}
                  </p>

                  {/* 楼中楼回复 */}
                  {shownReplies.length > 0 && (
                    <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
                      {shownReplies.map(r => (
                        <div key={r.id}>
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <Link
                              href={`/users/${r.author.id}`}
                              className="text-xs font-medium text-gray-800 hover:text-blue-500 no-underline"
                            >
                              {r.author.nickname}
                            </Link>
                            <VerifiedBadge verified={!!r.author.verified} />
                            <span className="text-[11px] text-gray-400">
                              {new Date(r.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <p className="pl-1 text-xs text-gray-600">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 展开 / 收起回复 */}
                  {hasMore && (
                    <button
                      onClick={() => toggleExpandReplies(c.id)}
                      className="ml-4 mt-2 text-xs text-blue-500 hover:text-blue-600"
                    >
                      {expanded
                        ? '收起回复'
                        : `展开回复 (剩余 ${replies.length - REPLY_PREVIEW_COUNT} 条)`}
                    </button>
                  )}

                  {/* 回复按钮 / 内联回复输入框 */}
                  {me && (
                    <div className="mt-2">
                      {replyToId === c.id ? (
                        <div className="ml-4 flex gap-2">
                          <input
                            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                            placeholder={`回复 ${c.author.nickname}…`}
                            value={replyContent}
                            onChange={e => setReplyContent(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => submitReply(c.id)}
                            disabled={replyBusy || !replyContent.trim()}
                            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            {replyBusy ? '发送中…' : '回复'}
                          </button>
                          <button
                            onClick={() => {
                              setReplyToId(null);
                              setReplyContent('');
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setReplyToId(c.id);
                            setReplyContent('');
                          }}
                          className="ml-1 text-xs text-gray-500 hover:text-blue-500"
                        >
                          回复
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 图片放大灯箱 (复用 user 页面 lightbox 模式) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex w-full max-w-3xl flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 text-lg font-bold text-white">{detail.type}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt={detail.type}
              className="max-h-[75vh] max-w-full rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setLightbox(null)}
              className="mt-4 rounded-full bg-white/20 px-5 py-2 text-sm text-white hover:bg-white/30"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
