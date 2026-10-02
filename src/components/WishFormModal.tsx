'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function WishFormModal({ open, onClose, onSubmitted }: Props) {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  if (!open) return null;

  const reset = () => {
    setItemName(''); setDescription(''); setImage(null); setErr(''); setShowSuccess(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

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
      setErr('请填写物品名称和描述');
      return;
    }
    setSubmitting(true); setErr('');
    try {
      await api.post('/api/wishes', {
        itemName: itemName.trim(),
        description: description.trim(),
        image,
      });
      setShowSuccess(true);
      onSubmitted?.();
    } catch (e: any) {
      setErr(e?.message || '提交失败');
    } finally { setSubmitting(false); }
  };

  // 提交成功弹窗
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center" onClick={e => e.stopPropagation()}>
          {/* 圆圈勾 */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-12 w-12 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">许愿提交成功!</h3>
          <p className="text-sm text-gray-500 mb-1">管理员已收到你的许愿</p>
          <p className="text-xs text-gray-400 mb-6">可在「我的 → 许愿单」中查看进度</p>
          <button
            onClick={handleClose}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-medium text-white hover:bg-amber-600 transition"
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  // 许愿表单弹窗
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={handleClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">🎯 我要许愿</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">物品名称 <span className="text-red-500">*</span></label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              maxLength={50}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="想兑换的物品名称, 如: 校园定制水杯"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述 <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm resize-none focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="描述你想要的物品或事件, 方便管理员理解并采纳"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/500</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">上传图片 (可选)</label>
            <div className="flex items-center gap-3">
              {image && (
                <div className="relative">
                  <img src={image} alt="" className="h-20 w-20 rounded-xl object-cover" />
                  <button onClick={() => setImage(null)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs">×</button>
                </div>
              )}
              <label className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400 hover:border-amber-300 hover:text-amber-500 transition">
                {image ? '更换图片' : '+ 选择图片'}
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-sm font-medium text-white shadow-sm shadow-amber-500/20 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 transition"
        >
          {submitting ? '提交中…' : '提交许愿'}
        </button>
      </div>
    </div>
  );
}
