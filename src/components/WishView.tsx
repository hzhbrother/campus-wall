'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';

interface Wish {
  id: string;
  itemName: string;
  description: string;
  image?: string | null;
  status: string;
  createdAt: string;
  user: { nickname: string };
}

export function WishView({ onBack }: { onBack: () => void }) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get<{ wishes: Wish[] }>('/api/wishes?limit=20')
      .then(d => setWishes(d.wishes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 1024, 0.7);
      setImage(base64);
    } catch {
      alert('图片处理失败, 请重试');
    }
  };

  const submit = async () => {
    if (!itemName.trim() || !description.trim()) {
      setMsg('请填写物品名称和描述');
      return;
    }
    setSubmitting(true); setMsg('');
    try {
      await api.post('/api/wishes', { itemName: itemName.trim(), description: description.trim(), image });
      setItemName(''); setDescription(''); setImage(null); setShowForm(false);
      setMsg('许愿提交成功! 管理员将收到邮件通知');
      load();
    } catch (e: any) {
      setMsg(e?.message || '提交失败');
    } finally { setSubmitting(false); }
  };

  const statusBadge = (s: string) => {
    if (s === 'ADOPTED') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">已采纳</span>;
    if (s === 'REVIEWED') return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">已查看</span>;
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600">待查看</span>;
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">🎯 许愿单</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          {showForm ? '收起' : '我要许愿'}
        </button>
      </div>

      {msg && <div className={`text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      {/* 许愿表单 */}
      {showForm && (
        <div className="rounded-2xl bg-white shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">物品名称 <span className="text-red-500">*</span></label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              maxLength={50}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="想兑换的物品名称, 如: 校园定制水杯"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述 <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="描述你想要的物品或事件, 方便管理员理解并采纳"
            />
            <p className="text-xs text-gray-400 mt-1">{description.length}/500</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">上传图片 (可选)</label>
            <div className="flex items-center gap-3">
              {image && (
                <img src={image} alt="" className="h-20 w-20 rounded-lg object-cover" />
              )}
              <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                {image ? '更换图片' : '选择图片'}
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
              {image && (
                <button onClick={() => setImage(null)} className="text-sm text-red-400 hover:text-red-500">删除</button>
              )}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {submitting ? '提交中…' : '提交许愿'}
          </button>
        </div>
      )}

      {/* 许愿列表 */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">加载中…</p>
      ) : wishes.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <p className="text-4xl mb-2">🎯</p>
          <p className="text-gray-400 text-sm">还没有人许愿, 快来第一个许愿吧!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wishes.map(w => (
            <div key={w.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="flex gap-3 p-4">
                {w.image && (
                  <img src={w.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">{w.itemName}</span>
                    {statusBadge(w.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{w.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <span>{w.user?.nickname || '匿名'}</span>
                    <span>·</span>
                    <span>{new Date(w.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
