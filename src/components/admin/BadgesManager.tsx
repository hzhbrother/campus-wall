'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  conditionType: string;
  threshold: number;
  isActive: boolean;
  createdAt: string;
}

interface BadgeHolder {
  id: string;
  earnedAt: string;
  user: { id: string; nickname: string; avatar: string | null; realName: string | null };
}

interface SearchUser {
  id: string;
  nickname: string;
  avatar: string | null;
  realName: string | null;
}

const CONDITION_LABELS: Record<string, string> = {
  POST_COUNT: '发帖数',
  LIKE_COUNT: '获赞数',
  COMMENT_COUNT: '评论数',
  CHECKIN_DAYS: '连续签到天数',
  POINTS: '积分',
  MANUAL: '手动授予',
  NIGHT_OWL: '连续凌晨活跃天数',
  HOT_POST: '单帖最高获赞',
  TOP_COMMENT: '单条评论最高回复数',
  HELPER: '求助问答获赞',
};

export function BadgesManager() {
  const [items, setItems] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Badge | null>(null);
  // 授予/撤销弹窗
  const [grantBadge, setGrantBadge] = useState<Badge | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: Badge[] }>('/api/admin/badges')
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm('确定删除该徽章?')) return;
    try {
      await api.del(`/api/admin/badges/${id}`);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const toggleActive = async (b: Badge) => {
    try {
      await api.patch(`/api/admin/badges/${b.id}`, { isActive: !b.isActive });
      load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">徽章管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">配置徽章获得条件, 用户满足条件后自动授予 (发帖/评论/点赞时触发); 手动类型的徽章可在此直接授予用户</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800"
        >
          + 新建徽章
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-gray-400">加载中…</p>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <div className="text-4xl mb-2">🏅</div>
          <p className="text-sm">还没有徽章, 点击右上角新建</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="py-2 pr-3">徽章</th>
                <th className="py-2 pr-3">描述</th>
                <th className="py-2 pr-3">条件</th>
                <th className="py-2 pr-3">阈值</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={b.id} className="border-b border-gray-50">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      {b.imageUrl ? (
                        <img src={b.imageUrl} alt={b.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-2xl">{b.icon || '🏅'}</span>
                      )}
                      <span className="font-medium text-gray-800">{b.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-gray-500">{b.description || '-'}</td>
                  <td className="py-3 pr-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{CONDITION_LABELS[b.conditionType] || b.conditionType}</span>
                  </td>
                  <td className="py-3 pr-3 text-gray-700">{b.threshold}</td>
                  <td className="py-3 pr-3">
                    <button onClick={() => toggleActive(b)} className={`rounded-full px-2 py-0.5 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {b.isActive ? '启用' : '停用'}
                    </button>
                  </td>
                  <td className="py-3 pr-3">
                    <button onClick={() => setGrantBadge(b)} className="text-amber-600 hover:underline mr-3">授予</button>
                    <button onClick={() => { setEditing(b); setShowForm(true); }} className="text-blue-500 hover:underline mr-3">编辑</button>
                    <button onClick={() => remove(b.id)} className="text-red-400 hover:underline">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <BadgeForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {grantBadge && (
        <GrantBadgeModal
          badge={grantBadge}
          onClose={() => setGrantBadge(null)}
          onChanged={() => {}}
        />
      )}
    </div>
  );
}

// ---------- 授予/撤销勋章弹窗 ----------
function GrantBadgeModal({ badge, onClose }: { badge: Badge; onClose: () => void; onChanged: () => void }) {
  const [holders, setHolders] = useState<BadgeHolder[]>([]);
  const [holdersLoading, setHoldersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadHolders = useCallback(async () => {
    setHoldersLoading(true);
    try {
      const d = await api.get<{ items: BadgeHolder[] }>(`/api/admin/badges/${badge.id}/grant`);
      setHolders(d.items || []);
    } catch { setHolders([]); }
    finally { setHoldersLoading(false); }
  }, [badge.id]);

  useEffect(() => { loadHolders(); }, [loadHolders]);

  // 搜索用户 (防抖)
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api.get<{ items: SearchUser[] }>(`/api/admin/users?q=${encodeURIComponent(search)}&pageSize=20`)
        .then(d => setSearchResults(d.items || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const grant = async (userId: string) => {
    setBusy(true); setMsg('');
    try {
      await api.post(`/api/admin/badges/${badge.id}/grant`, { userId });
      setMsg('已授予');
      setSearch('');
      loadHolders();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const revoke = async (userId: string) => {
    if (!confirm('确认撤销该用户的徽章?')) return;
    setBusy(true); setMsg('');
    try {
      await api.del(`/api/admin/badges/${badge.id}/grant?userId=${userId}`);
      setMsg('已撤销');
      loadHolders();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const holderIds = new Set(holders.map(h => h.user.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {badge.imageUrl ? (
              <img src={badge.imageUrl} alt={badge.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="text-2xl">{badge.icon || '🏅'}</span>
            )}
            <h3 className="text-lg font-bold text-gray-900">授予「{badge.name}」</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        {msg && <p className={`mb-3 text-sm ${msg.includes('已') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}

        {/* 搜索并授予 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">搜索用户并授予</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="输入昵称/姓名搜索"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          {searching && <p className="mt-1 text-xs text-gray-400">搜索中…</p>}
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs">
                      {u.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : (u.nickname || 'U')[0]}
                    </div>
                    <div>
                      <div className="text-sm text-gray-800">{u.nickname}</div>
                      {u.realName && <div className="text-xs text-gray-400">{u.realName}</div>}
                    </div>
                  </div>
                  {holderIds.has(u.id) ? (
                    <span className="text-xs text-green-600">已拥有</span>
                  ) : (
                    <button onClick={() => grant(u.id)} disabled={busy} className="rounded-lg bg-amber-500 px-3 py-1 text-xs text-white hover:bg-amber-600 disabled:opacity-50">授予</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 已有此勋章的用户 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">已拥有此徽章 ({holders.length})</label>
          </div>
          {holdersLoading ? (
            <p className="py-4 text-center text-xs text-gray-400">加载中…</p>
          ) : holders.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">暂无用户拥有此徽章</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {holders.map(h => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs">
                      {h.user.avatar ? <img src={h.user.avatar} alt="" className="h-full w-full object-cover" /> : (h.user.nickname || 'U')[0]}
                    </div>
                    <div>
                      <div className="text-sm text-gray-800">{h.user.nickname}</div>
                      <div className="text-xs text-gray-400">{new Date(h.earnedAt).toLocaleDateString('zh-CN')} 获得</div>
                    </div>
                  </div>
                  <button onClick={() => revoke(h.user.id)} disabled={busy} className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50">撤销</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <button onClick={onClose} className="w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-600 hover:bg-gray-200">关闭</button>
        </div>
      </div>
    </div>
  );
}

function BadgeForm({ initial, onClose, onSaved }: { initial: Badge | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  // imageUrl 存 base64 data URL 或外链 URL; 上传图片后存 base64
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  // icon 字段保留作为没有图片时的兜底显示 (默认 🏅), 不再在表单中编辑
  const [icon] = useState(initial?.icon || '🏅');
  const [conditionType, setConditionType] = useState(initial?.conditionType || 'POST_COUNT');
  const [threshold, setThreshold] = useState(initial?.threshold || 1);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 从相册/图库选择图片 (不调用摄像头)
  const handlePick = () => fileRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg('请选择图片文件'); return; }
    setUploading(true); setMsg('');
    try {
      // 压缩到 base64 (保留 PNG 透明背景, 用于徽章/奖牌)
      const dataUrl = await compressImage(file, 512, 0.85, true);
      setImageUrl(dataUrl);
    } catch (e: any) { setMsg(e.message || '图片处理失败'); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!name.trim()) { setMsg('请填写徽章名称'); return; }
    if (!imageUrl) { setMsg('请上传徽章图片'); return; }
    setBusy(true); setMsg('');
    try {
      const payload = { name: name.trim(), description, icon, imageUrl, conditionType, threshold: Number(threshold), isActive };
      if (initial) {
        await api.patch(`/api/admin/badges/${initial.id}`, payload);
      } else {
        await api.post('/api/admin/badges', payload);
      }
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{initial ? '编辑徽章' : '新建徽章'}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <div className="space-y-3">
          {/* 徽章图片: 从相册/图库上传 (不调用摄像头) */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">徽章图片 <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-400 mb-2">从相册/图库上传, 建议透明背景 PNG, 清晰可见即可</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0])}
            />
            {imageUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="徽章预览" className="h-20 w-20 rounded-full object-cover border border-gray-200 bg-gray-50" />
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={handlePick} disabled={uploading}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                    {uploading ? '处理中…' : '重新上传'}
                  </button>
                  <button type="button" onClick={() => setImageUrl('')} disabled={uploading}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50">
                    移除图片
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={handlePick} disabled={uploading}
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50">
                {uploading ? (
                  <span className="text-xs">处理中…</span>
                ) : (
                  <span className="text-2xl">+</span>
                )}
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">徽章名称</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={50}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">描述</label>
            <input value={description} onChange={e => setDescription(e.target.value)} maxLength={200}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">获得条件</label>
              <select value={conditionType} onChange={e => setConditionType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">达到阈值</label>
              <input type="number" min={1} value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            启用此徽章
          </label>
          {msg && <p className="text-sm text-red-500">{msg}</p>}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-gray-200 py-2 text-sm text-gray-600">取消</button>
          <button onClick={submit} disabled={busy}
            className="flex-1 rounded-full bg-blue-500 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50">
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
