'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  conditionType: string;
  threshold: number;
  isActive: boolean;
  createdAt: string;
}

const CONDITION_LABELS: Record<string, string> = {
  POST_COUNT: '发帖数',
  LIKE_COUNT: '获赞数',
  COMMENT_COUNT: '评论数',
  CHECKIN_DAYS: '连续签到天数',
  POINTS: '积分',
  MANUAL: '手动授予',
};

export function BadgesManager() {
  const [items, setItems] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Badge | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: Badge[] }>('/api/admin/badges')
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm('确定删除该勋章?')) return;
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
          <h3 className="text-lg font-bold text-gray-900">勋章管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">配置勋章获得条件, 用户满足条件后自动授予 (发帖/评论/点赞时触发)</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800"
        >
          + 新建勋章
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-gray-400">加载中…</p>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <div className="text-4xl mb-2">🏅</div>
          <p className="text-sm">还没有勋章, 点击右上角新建</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="py-2 pr-3">勋章</th>
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
                      <span className="text-2xl">{b.icon || '🏅'}</span>
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
    </div>
  );
}

function BadgeForm({ initial, onClose, onSaved }: { initial: Badge | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [icon, setIcon] = useState(initial?.icon || '🏅');
  const [conditionType, setConditionType] = useState(initial?.conditionType || 'POST_COUNT');
  const [threshold, setThreshold] = useState(initial?.threshold || 1);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!name.trim()) { setMsg('请填写勋章名称'); return; }
    setBusy(true); setMsg('');
    try {
      const payload = { name: name.trim(), description, icon, conditionType, threshold: Number(threshold), isActive };
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
          <h3 className="text-lg font-bold text-gray-900">{initial ? '编辑勋章' : '新建勋章'}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">勋章图标 (emoji)</label>
            <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">勋章名称</label>
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
            启用此勋章
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
