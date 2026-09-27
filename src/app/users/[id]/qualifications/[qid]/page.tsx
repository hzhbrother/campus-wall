'use client';

// 奖状/资质详情页 (参考小黄人急救勋章证书页)
// 布局: 大图 → 底部栏(Nº编码 + 可见性 + ❤️ + ↗️) → 评论区
// 路由: /users/[id]/qualifications/[qid]

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePageRefresh } from '@/lib/use-page-refresh';
import { VerifiedBadge } from '@/components/VerifiedBadge';

type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

interface QualificationUser {
  id: string;
  nickname: string;
  avatar: string | null;
  verified: boolean;
}

interface QualificationDetail {
  id: string;
  type: string;
  category: string;
  photo: string | null;
  photo2: string | null;
  displayPhoto: string | null;
  status: string;
  verified: boolean;
  verifiedAt: string | null;
  visibility: Visibility;
  userId: string;
  createdAt: string;       // 申请时间 (用于 Nº 编码)
  user: QualificationUser;
  _count: { comments: number; likes: number };
  liked: boolean;         // 当前用户是否已点赞
}

interface QualificationComment {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: { id: string; nickname: string; avatar: string | null; verified: boolean };
  replies?: QualificationComment[];
  _count?: { replies?: number };
}

// 楼中楼默认显示前 N 条回复
const REPLY_PREVIEW = 3;

// 生成 Nº 编码: YYYY + MMDD + HHmm
// 例: 2026年6月30日 6:30 → "202606300630"
function genNoCode(createdAt: string): string {
  const d = new Date(createdAt);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const yyyy = d.getFullYear();
  const mmdd = pad(d.getMonth() + 1) + pad(d.getDate());
  const hhmm = pad(d.getHours()) + pad(d.getMinutes());
  return `${yyyy}${mmdd}${hhmm}`;
}

// 可见性标签文案
const VIS_LABEL: Record<Visibility, { label: string; icon: string }> = {
  PUBLIC:    { label: '全员可见',   icon: '👁' },
  FOLLOWERS: { label: '仅粉丝可见', icon: '👥' },
  PRIVATE:   { label: '不公开',     icon: '🔒' },
};

export default function QualificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuth();
  const userId = params?.id as string;
  const qid = params?.qid as string;

  const [detail, setDetail] = useState<QualificationDetail | null>(null);
  const [comments, setComments] = useState<QualificationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [forbidden, setForbidden] = useState<Visibility | ''>('');

  // 图片放大灯箱
  const [lightbox, setLightbox] = useState<string | null>(null);

  // 可见性切换
  const [visBusy, setVisBusy] = useState(false);

  // 点赞
  const [likeBusy, setLikeBusy] = useState(false);

  // 分享
  const [shareTip, setShareTip] = useState('');

  // 评论输入
  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  // 楼中楼
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // 403 引导关注
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  // 可见性切换菜单弹窗
  const [showVisMenu, setShowVisMenu] = useState(false);

  const isOwn = !!me && !!detail && me.id === detail.userId;

  // ---------- 加载 ----------
  const loadDetail = useCallback(async () => {
    if (!qid) return;
    try {
      const d = await api.get<QualificationDetail>(`/api/qualifications/${qid}`);
      setDetail(d);
      setForbidden('');
      setErr('');
    } catch (e: any) {
      const status = e?.status;
      if (status === 404) setErr('奖状不存在或未通过审核');
      else if (status === 403) setForbidden((e?.data?.visibility as Visibility) || 'FOLLOWERS');
      else setErr(e?.message || '加载失败');
    }
  }, [qid]);

  const loadComments = useCallback(async () => {
    if (!qid) return;
    try {
      const res = await api.get<{ items: QualificationComment[] }>(
        `/api/qualifications/${qid}/comments?page=1&pageSize=50`,
      );
      setComments(res.items || []);
    } catch { /* 忽略 */ }
  }, [qid]);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([loadDetail(), loadComments()]).finally(() => setLoading(false));
  }, [loadDetail, loadComments]);

  usePageRefresh(loadAll, [loadAll]);

  // 403 引导关注时查关注状态
  useEffect(() => {
    if (!me?.id || !userId || isOwn || forbidden !== 'FOLLOWERS') return;
    let cancelled = false;
    api.get<{ items: { id: string }[] }>(`/api/users/me/follow?page=1&pageSize=200`)
      .then(d => { if (!cancelled) setFollowing((d.items || []).some(it => it.id === userId)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [me?.id, isOwn, userId, forbidden]);

  // ---------- 操作 ----------
  const toggleFollow = async () => {
    if (followBusy || !userId) return;
    setFollowBusy(true);
    try {
      if (following) { await api.del(`/api/users/me/follow/${userId}`); setFollowing(false); }
      else { await api.post('/api/users/me/follow', { userId }); setFollowing(true); }
    } catch (e: any) { alert(e.message || '操作失败'); }
    finally { setFollowBusy(false); }
  };

  const changeVisibility = async (vis: Visibility) => {
    if (!detail || visBusy || !isOwn || vis === detail.visibility) return;
    const prev = detail.visibility;
    setDetail(d => (d ? { ...d, visibility: vis } : d));
    setVisBusy(true);
    try { await api.patch(`/api/qualifications/${qid}`, { visibility: vis }); }
    catch { setDetail(d => (d ? { ...d, visibility: prev } : d)); alert('更新失败'); }
    finally { setVisBusy(false); }
  };

  const toggleLike = async () => {
    if (!me) { router.push('/login'); return; }
    if (!detail || likeBusy) return;
    setLikeBusy(true);
    const prevLiked = detail.liked;
    const prevCount = detail._count.likes;
    // 乐观更新
    setDetail(d => d ? { ...d, liked: !prevLiked, _count: { ...d._count, likes: prevLiked ? prevCount - 1 : prevCount + 1 } } : d);
    try {
      await api.post(`/api/qualifications/${qid}/like`, {});
    } catch (e: any) {
      setDetail(d => d ? { ...d, liked: prevLiked, _count: { ...d._count, likes: prevCount } } : d);
      alert(e.message || '操作失败');
    } finally { setLikeBusy(false); }
  };

  const doShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = detail?.type || '奖状证书';
    const shareData = { title, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShareTip('链接已复制');
        setTimeout(() => setShareTip(''), 1500);
      }
    } catch { /* 用户取消分享等 */ }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) { router.push('/login'); return; }
    if (!comment.trim()) return;
    setCommentBusy(true);
    try {
      await api.post(`/api/qualifications/${qid}/comments`, { content: comment.trim() });
      setComment('');
      await loadComments();
      setDetail(d => d ? { ...d, _count: { ...d._count, comments: d._count.comments + 1 } } : d);
    } catch (e: any) { alert(e?.status === 403 ? '无评论权限' : e.message || '评论失败'); }
    finally { setCommentBusy(false); }
  };

  const submitReply = async (parentId: string) => {
    if (!me) { router.push('/login'); return; }
    if (!replyContent.trim()) return;
    setReplyBusy(true);
    try {
      await api.post(`/api/qualifications/${qid}/comments`, { content: replyContent.trim(), parentId });
      setReplyContent(''); setReplyToId(null);
      await loadComments();
    } catch (e: any) { alert(e?.status === 403 ? '无评论权限' : e.message || '回复失败'); }
    finally { setReplyBusy(false); }
  };

  // ---------- 渲染 ----------
  if (loading) return <div className="py-12 text-center text-gray-400">加载中…</div>;

  if (err) return (
    <div className="py-12 text-center">
      <p className="text-gray-500">{err}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-blue-500">返回</button>
    </div>
  );

  if (forbidden) return (
    <div className="py-12 text-center">
      <p className="text-gray-500">{forbidden === 'PRIVATE' ? '该奖状不公开, 仅作者可见' : '该奖状仅粉丝可见'}</p>
      {forbidden === 'FOLLOWERS' && !isOwn && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-sm text-gray-400">关注作者后即可查看</p>
          <button onClick={toggleFollow} disabled={followBusy}
            className={`rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-50 ${following ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'}`}
          >{following ? '✓ 已关注' : '+ 关注'}</button>
        </div>
      )}
      <button onClick={() => router.back()} className="mt-4 text-sm text-blue-500">返回</button>
    </div>
  );

  if (!detail) return <div className="py-12 text-center text-gray-400">奖状不存在</div>;

  // 选定主展示图
  const primaryPhoto = detail.displayPhoto === 'photo2'
    ? detail.photo2 || detail.photo
    : detail.displayPhoto === 'photo'
      ? detail.photo || detail.photo2
      : detail.photo || detail.photo2;
  const photos = [detail.photo, detail.photo2].filter((p): p is string => !!p);

  const noCode = genNoCode(detail.createdAt);
  const visInfo = VIS_LABEL[detail.visibility];

  return (
    <div className="space-y-0">
      {/* 顶部: 返回 + 标题 */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← 返回</button>
        <h1 className="flex-1 truncate text-base font-bold text-gray-900">奖状证书</h1>
        {detail.category === 'HONOR' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">荣誉</span>}
      </div>

      {/* 大图展示 (参考图: 几乎全屏的大图) */}
      <div className="bg-white p-3">
        {primaryPhoto ? (
          <button onClick={() => setLightbox(primaryPhoto)}
            className="block w-full overflow-hidden rounded-lg border border-gray-100 transition hover:border-gray-300"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={primaryPhoto} alt={detail.type} className="max-h-[70vh] w-full object-contain bg-gray-50" />
          </button>
        ) : (
          <div className="py-16 text-center text-sm text-gray-400">暂无证书图片</div>
        )}
      </div>

      {/* 底部信息栏 (参考图: Nº + 可见性 + ❤️ + ↗️) */}
      <div className="mx-3 mb-3 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 shadow-sm">
        {/* 左: Nº 编码 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Nº</span>
          <span className="font-mono text-sm font-bold text-gray-800 tracking-wide">{noCode}</span>
        </div>

        {/* 右: 可见性 + 点赞 + 分享 */}
        <div className="flex items-center gap-1">
          {/* 可见性 (owner 可点击切换, 非 owner 只展示) */}
          {isOwn ? (
            <div className="relative">
              <button
                onClick={() => setShowVisMenu(v => !v)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                <span>{visInfo.icon}</span>
                <span>{visInfo.label}</span>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {showVisMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowVisMenu(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    {(['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as Visibility[]).map(v => {
                      const { label, icon } = VIS_LABEL[v];
                      const active = detail.visibility === v;
                      return (
                        <button key={v}
                          onClick={() => { changeVisibility(v); setShowVisMenu(false); }}
                          disabled={visBusy || active}
                          className={`block w-full px-3 py-2 text-left text-sm transition ${active ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          <span className="mr-1">{icon}</span>{label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-500">
              <span>{visInfo.icon}</span>
              <span>{visInfo.label}</span>
            </div>
          )}

          {/* 点赞 */}
          <button
            onClick={toggleLike}
            disabled={likeBusy}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition disabled:opacity-50 ${detail.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
          >
            <span className={detail.liked ? 'text-red-500' : ''}>{detail.liked ? '❤️' : '🤍'}</span>
            <span className="tabular-nums">{detail._count.likes || 0}</span>
          </button>

          {/* 分享 */}
          <button
            onClick={doShare}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 hover:text-blue-500"
          >
            <span>↗️</span>
          </button>
        </div>
      </div>
      {shareTip && (
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">
          {shareTip}
        </div>
      )}

      {/* 作者信息 (小卡片) */}
      <Link href={`/users/${detail.user.id}`} className="mx-3 mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm no-underline hover:bg-gray-50">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
          {detail.user.avatar
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={detail.user.avatar} alt="" className="h-full w-full object-cover" />
            : (detail.user.nickname || 'U')[0].toUpperCase()}
        </div>
        <span className="flex-1 text-sm font-medium text-gray-800">{detail.user.nickname}</span>
        <VerifiedBadge verified={!!detail.user.verified} />
        {detail.verifiedAt && <span className="text-xs text-gray-400">{new Date(detail.verifiedAt).toLocaleDateString('zh-CN')}</span>}
      </Link>

      {/* 评论区 */}
      <div className="mx-3 mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-900">评论 ({comments.length})</h3>

        {/* 输入框 */}
        <form onSubmit={submitComment} className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder={me ? '说点什么吧 ~' : '请先登录后评论'}
            value={comment}
            onChange={e => setComment(e.target.value)}
            disabled={!me || commentBusy}
          />
          <button type="submit" disabled={!me || commentBusy || !comment.trim()}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >{commentBusy ? '发送中…' : '发布'}</button>
        </form>

        {/* 列表 */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">还没有评论, 来抢沙发~</p>
          ) : (
            [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(c => {
              const replies = c.replies || [];
              const expanded = expandedReplies.has(c.id);
              const shownReplies = expanded ? replies : replies.slice(0, REPLY_PREVIEW);
              const hasMore = replies.length > REPLY_PREVIEW;
              return (
                <div key={c.id} className="rounded-xl bg-gray-50/60 p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Link href={`/users/${c.author.id}`} className="flex items-center gap-1.5 no-underline">
                      <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-[10px] font-bold text-white">
                        {c.author.avatar
                          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.author.avatar} alt="" className="h-full w-full object-cover" />
                          : (c.author.nickname || 'U')[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{c.author.nickname}</span>
                    </Link>
                    <VerifiedBadge verified={!!c.author.verified} />
                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="whitespace-pre-wrap pl-1 text-sm text-gray-700">{c.content}</p>

                  {shownReplies.length > 0 && (
                    <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
                      {shownReplies.map(r => (
                        <div key={r.id}>
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <Link href={`/users/${r.author.id}`} className="text-xs font-medium text-gray-800 hover:text-blue-500 no-underline">{r.author.nickname}</Link>
                            <VerifiedBadge verified={!!r.author.verified} />
                            <span className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                          <p className="pl-1 text-xs text-gray-600">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasMore && (
                    <button onClick={() => setExpandedReplies(p => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                      className="ml-4 mt-2 text-xs text-blue-500 hover:text-blue-600"
                    >{expanded ? '收起回复' : `展开回复 (剩余 ${replies.length - REPLY_PREVIEW} 条)`}</button>
                  )}

                  {me && (
                    <div className="mt-2">
                      {replyToId === c.id ? (
                        <div className="ml-4 flex gap-2">
                          <input className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                            placeholder={`回复 ${c.author.nickname}…`} value={replyContent}
                            onChange={e => setReplyContent(e.target.value)} autoFocus />
                          <button onClick={() => submitReply(c.id)} disabled={replyBusy || !replyContent.trim()}
                            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white disabled:opacity-50">{replyBusy ? '发送中' : '回复'}</button>
                          <button onClick={() => { setReplyToId(null); setReplyContent(''); }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => { setReplyToId(c.id); setReplyContent(''); }}
                          className="ml-1 text-xs text-gray-500 hover:text-blue-500">回复</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 图片放大灯箱 */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <div onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt={detail.type} className="max-h-[85vh] max-w-[92vw] rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
