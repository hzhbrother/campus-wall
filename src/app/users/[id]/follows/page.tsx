'use client';

// 关注 / 粉丝列表页
// 后端: GET /api/users/:id/follow?type=following|followers&page=&pageSize=
// 隐私: 目标用户 followsPublic=false 且访问者非本人 -> 403
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePageRefresh } from '@/lib/use-page-refresh';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface FollowUser {
  id: string;
  nickname: string;
  avatar: string | null;
  realName: string | null;
  verified: boolean;
}

interface FollowResp {
  items: FollowUser[];
  total: number;
  type: 'following' | 'followers';
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

function FollowsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: me } = useAuth();

  const userId = params?.id as string;
  const type = searchParams.get('type') === 'followers' ? 'followers' : 'following';

  const [page, setPage] = useState(1);
  const [data, setData] = useState<FollowResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [errCode, setErrCode] = useState(0);
  const [errMsg, setErrMsg] = useState('');

  // 是否本人 (用于 tab 可见性判断: 本人始终可访问, 非本人由后端按隐私设置返回 403)
  const isOwn = !!me && me.id === userId;

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setErrCode(0);
    setErrMsg('');
    api.get<FollowResp>(`/api/users/${userId}/follow?type=${type}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then(setData)
      .catch((e: ApiError | Error) => {
        setErrCode(e instanceof ApiError ? e.status : 0);
        setErrMsg(e.message);
      })
      .finally(() => setLoading(false));
  }, [userId, type, page]);

  // 挂载 + 标签页重新激活时刷新
  usePageRefresh(load, [load]);
  useEffect(() => { load(); }, [load]);

  // 切换 tab: 更新 URL 上的 type, 同时重置页码
  const switchTab = (next: 'following' | 'followers') => {
    if (next === type) return;
    setPage(1);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('type', next);
    sp.delete('page');
    router.replace(`/users/${userId}/follows?${sp.toString()}`);
  };

  const title = type === 'following' ? '关注' : '粉丝';
  const emptyText = type === 'following' ? '暂无关注' : '暂无粉丝';
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-3">
      {/* 顶部返回 + 标题 */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回
        </button>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>

      {/* Tab 切换: 关注 | 粉丝 */}
      <div className="flex rounded-2xl bg-white p-1 shadow-sm">
        {(['following', 'followers'] as const).map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${type === t ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {t === 'following' ? '关注' : '粉丝'}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中…</div>
      ) : errCode === 403 ? (
        // 对方隐藏关注列表 (非本人 + followsPublic=false)
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-gray-500">对方已隐藏关注列表</p>
        </div>
      ) : errCode ? (
        <div className="py-12 text-center text-red-500">{errMsg || '加载失败'}</div>
      ) : !data || data.items.length === 0 ? (
        <div className="py-16 text-center text-gray-400">{emptyText}</div>
      ) : (
        <>
          {/* 用户列表 */}
          <div className="space-y-2">
            {data.items.map(u => (
              <Link
                key={u.id}
                href={`/users/${u.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm hover:bg-gray-50 no-underline"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (u.nickname || 'U')[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-900 truncate">{u.nickname}</span>
                    <VerifiedBadge verified={u.verified} />
                  </div>
                  {u.realName && (
                    <div className="mt-0.5 text-xs text-gray-400 truncate">{u.realName}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* 分页: 上一页 / 下一页 */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="text-xs text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function FollowsPage() {
  // useSearchParams 需在 Suspense 边界内使用, 否则静态构建会报错
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">加载中…</div>}>
      <FollowsContent />
    </Suspense>
  );
}
