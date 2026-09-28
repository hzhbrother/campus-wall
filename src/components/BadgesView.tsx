'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BadgeCelebration } from './BadgeCelebration';

interface UserBadge {
  id: string;
  badgeId: string;
  earnedAt: string;
  claimedAt: string | null; // null 表示待领取
  badge: { id: string; name: string; description?: string | null; icon?: string | null; imageUrl?: string | null; conditionType: string; threshold: number };
}

interface Qualification {
  id: string;
  type: string;
  category: 'QUALIFICATION' | 'HONOR';
  status: string;
  verified: boolean;
  verifiedAt: string | null;
  photo: string | null;
  photo2: string | null;
  displayPhoto: string | null;
  rejectReason: string | null;
  createdAt: string;
}

export function BadgesView({ onBack }: { onBack: () => void }) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [quals, setQuals] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ id: string; imageUrl: string | null; icon: string | null; name: string; description: string | null; earnedAt: string; claimedAt: string | null } | null>(null);
  // 证书/荣誉图片放大灯箱
  const [certLightbox, setCertLightbox] = useState<{ type: string; photo: string } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ items: UserBadge[] }>('/api/users/me/badges').then(d => d.items || []).catch(() => []),
      api.get<{ items: Qualification[] }>('/api/users/me/qualifications').then(d => d.items || []).catch(() => []),
    ]).then(([b, q]) => {
      setBadges(b);
      setQuals(q);
      setLoading(false);
    });
  }, []);

  const approvedQuals = quals.filter(q => q.verified);
  const pendingQuals = quals.filter(q => q.status === 'PENDING');
  const rejectedQuals = quals.filter(q => q.status === 'REJECTED');

  // 根据 displayPhoto 决定展示哪一面
  const getDisplayPhoto = (q: Qualification): string | null => {
    if (q.displayPhoto === 'photo2') return q.photo2;
    return q.photo || q.photo2;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING: 'bg-amber-100 text-amber-700',
      REJECTED: 'bg-red-100 text-red-600',
    };
    const label: Record<string, string> = { APPROVED: '已通过', PENDING: '审核中', REJECTED: '已驳回' };
    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${map[s] || 'bg-gray-100 text-gray-500'}`}>{label[s] || s}</span>;
  };

  // 领取勋章: 调用 claim 接口, 成功后本地把 claimedAt 设为当前时间 + 播放礼花动效
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ imageUrl: string | null; icon: string | null; name: string; description: string | null } | null>(null);
  const handleClaim = async (ubId: string) => {
    if (claimingId) return;
    const target = badges.find(b => b.id === ubId);
    setClaimingId(ubId);
    try {
      await api.post('/api/users/me/badges/' + ubId + '/claim');
      const nowIso = new Date().toISOString();
      // 本地把 claimedAt 设为当前时间, 徽章从灰变金
      setBadges(prev => prev.map(b => b.id === ubId ? { ...b, claimedAt: nowIso } : b));
      // 灯箱里也同步更新
      setLightbox(l => l && l.id === ubId ? { ...l, claimedAt: nowIso } : l);
      // 关闭灯箱, 播放礼花动效 (3 秒后自动关闭)
      setLightbox(null);
      if (target) {
        setCelebration({ imageUrl: target.badge.imageUrl || null, icon: target.badge.icon || null, name: target.badge.name, description: target.badge.description || null });
        setTimeout(() => setCelebration(null), 3500);
      }
    } catch (e: any) {
      alert(e.message || '领取失败');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>

      {loading ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="py-10 text-center text-gray-400">加载中…</p>
        </div>
      ) : (
        <>
          {/* ---- 资质认证 (标签形式) ---- */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">🎖️ 资质认证</h3>
              <span className="text-xs text-gray-400">{approvedQuals.filter(q => q.category === 'QUALIFICATION').length} 项</span>
            </div>
            {approvedQuals.filter(q => q.category === 'QUALIFICATION').length === 0 && pendingQuals.filter(q => q.category === 'QUALIFICATION').length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <div className="text-4xl mb-2">🎖️</div>
                <p className="text-sm">还没有资质认证, 去「认证」里提交吧~</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 已通过的资质 */}
                {approvedQuals.filter(q => q.category === 'QUALIFICATION').map(q => (
                  <div key={q.id} className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="h-4 w-4 text-green-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="text-sm font-medium text-gray-900 truncate">{q.type}</span>
                    </div>
                    {q.verifiedAt && <span className="text-xs text-gray-400 shrink-0">{new Date(q.verifiedAt).toLocaleDateString('zh-CN')}</span>}
                  </div>
                ))}
                {/* 审核中的资质 */}
                {pendingQuals.filter(q => q.category === 'QUALIFICATION').map(q => (
                  <div key={q.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                    <span className="text-sm text-gray-700 truncate">{q.type}</span>
                    {statusBadge(q.status)}
                  </div>
                ))}
                {/* 已驳回的资质 */}
                {rejectedQuals.filter(q => q.category === 'QUALIFICATION').map(q => (
                  <div key={q.id} className="rounded-xl bg-red-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate">{q.type}</span>
                      {statusBadge(q.status)}
                    </div>
                    {q.rejectReason && <p className="mt-1 text-xs text-red-500">原因: {q.rejectReason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- 荣誉认证 (证书图片形式, 可点击放大) ---- */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">🏆 荣誉认证</h3>
              <span className="text-xs text-gray-400">{approvedQuals.filter(q => q.category === 'HONOR').length} 项</span>
            </div>
            {approvedQuals.filter(q => q.category === 'HONOR').length === 0 && pendingQuals.filter(q => q.category === 'HONOR').length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <div className="text-4xl mb-2">🏆</div>
                <p className="text-sm">还没有荣誉认证, 去「认证」里提交吧~</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 已通过的荣誉 — 展示证书图片 */}
                {approvedQuals.filter(q => q.category === 'HONOR').map(q => {
                  const displayPhoto = getDisplayPhoto(q);
                  return (
                    <div key={q.id} className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-50">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-amber-600">🏆</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{q.type}</span>
                        </div>
                        {q.verifiedAt && <span className="text-xs text-gray-400 shrink-0">{new Date(q.verifiedAt).toLocaleDateString('zh-CN')}</span>}
                      </div>
                      {displayPhoto ? (
                        <button
                          onClick={() => setCertLightbox({ type: q.type, photo: displayPhoto })}
                          className="block w-full bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={displayPhoto} alt={q.type} className="w-full max-h-64 object-contain" />
                          <div className="py-1.5 text-center text-xs text-gray-400">点击放大查看证书</div>
                        </button>
                      ) : (
                        <div className="py-6 text-center text-xs text-gray-400">暂无证书图片</div>
                      )}
                    </div>
                  );
                })}
                {/* 审核中的荣誉 */}
                {pendingQuals.filter(q => q.category === 'HONOR').map(q => (
                  <div key={q.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                    <span className="text-sm text-gray-700 truncate">{q.type}</span>
                    {statusBadge(q.status)}
                  </div>
                ))}
                {/* 已驳回的荣誉 */}
                {rejectedQuals.filter(q => q.category === 'HONOR').map(q => (
                  <div key={q.id} className="rounded-xl bg-red-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate">{q.type}</span>
                      {statusBadge(q.status)}
                    </div>
                    {q.rejectReason && <p className="mt-1 text-xs text-red-500">原因: {q.rejectReason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- 勋章 ---- */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">🎖️ 我的徽章</h3>
              <span className="text-xs text-gray-400">{badges.length} 枚</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">点击徽章可放大查看, 完成任务即可获得徽章</p>
            {badges.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <div className="text-4xl mb-2">🏅</div>
                <p className="text-sm">还没有徽章, 快去发帖、签到获得吧~</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {badges.map(ub => {
                  const claimed = !!ub.claimedAt;
                  return (
                    <div key={ub.id} className="flex flex-col items-center text-center">
                      {/* 打开灯箱的按钮 (包裹徽章图片) */}
                      <button
                        onClick={() => setLightbox({ id: ub.id, imageUrl: ub.badge.imageUrl || null, icon: ub.badge.icon || null, name: ub.badge.name, description: ub.badge.description || null, earnedAt: ub.earnedAt, claimedAt: ub.claimedAt })}
                        className="relative"
                      >
                        {ub.badge.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={ub.badge.imageUrl} alt={ub.badge.name} className={`h-16 w-16 object-contain hover:scale-110 transition-transform ${!claimed ? 'grayscale opacity-60' : ''}`} />
                        ) : (
                          <div className={`flex h-16 w-16 items-center justify-center text-4xl hover:scale-110 transition-transform ${!claimed ? 'grayscale opacity-60' : ''}`}>
                            {ub.badge.icon || '🏅'}
                          </div>
                        )}
                        {/* 待领取角标 */}
                        {!claimed && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">待领取</span>
                        )}
                      </button>
                      <div className="mt-2 text-sm font-medium text-gray-800">{ub.badge.name}</div>
                      {ub.badge.description && <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{ub.badge.description}</div>}
                      {claimed ? (
                        <div className="text-[11px] text-amber-600 mt-1">{new Date(ub.claimedAt as string).getFullYear()} 年获得</div>
                      ) : (
                        <button
                          onClick={() => handleClaim(ub.id)}
                          disabled={claimingId === ub.id}
                          className="mt-1 rounded-full bg-blue-500 px-3 py-0.5 text-[11px] font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                        >
                          {claimingId === ub.id ? '领取中…' : '领取'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 勋章放大灯箱 */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <div className="flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {lightbox.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={lightbox.imageUrl} alt={lightbox.name} className={`h-32 w-32 object-contain drop-shadow-lg ${!lightbox.claimedAt ? 'grayscale opacity-60' : ''}`} />
            ) : (
              <div className={`flex h-32 w-32 items-center justify-center text-7xl ${!lightbox.claimedAt ? 'grayscale opacity-60' : ''}`}>
                {lightbox.icon || '🏅'}
              </div>
            )}
            <div className="mt-4 text-xl font-bold text-white">{lightbox.name}</div>
            {lightbox.description && (
              <div className="mt-2 text-sm text-white/70 max-w-xs text-center">{lightbox.description}</div>
            )}
            {lightbox.claimedAt ? (
              <div className="mt-2 text-xs text-white/50">{new Date(lightbox.claimedAt).toLocaleDateString('zh-CN')} 获得</div>
            ) : (
              <button
                onClick={() => handleClaim(lightbox.id)}
                disabled={claimingId === lightbox.id}
                className="mt-4 rounded-full bg-blue-500 px-8 py-2.5 text-base font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {claimingId === lightbox.id ? '领取中…' : '🎁 领取勋章'}
              </button>
            )}
            <button onClick={() => setLightbox(null)} className="mt-6 rounded-full bg-white/20 px-5 py-2 text-sm text-white hover:bg-white/30">关闭</button>
          </div>
        </div>
      )}

      {/* 荣誉证书放大灯箱 */}
      {certLightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setCertLightbox(null)}>
          <div className="flex flex-col items-center max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="mb-3 text-lg font-bold text-white">{certLightbox.type}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={certLightbox.photo} alt={certLightbox.type} className="max-h-[75vh] max-w-full rounded-lg shadow-2xl" />
            <button onClick={() => setCertLightbox(null)} className="mt-4 rounded-full bg-white/20 px-5 py-2 text-sm text-white hover:bg-white/30">关闭</button>
          </div>
        </div>
      )}

      {/* 徽章领取礼花动效 */}
      {celebration && (
        <BadgeCelebration badge={celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  );
}
