'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const CATEGORIES = ['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答'];

export default function NewPostPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ title: '', content: '', category: '校园', images: '', isAnonymous: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const images = form.images.split('\n').map((s) => s.trim()).filter(Boolean);
      const res = await api.post<{ id: string; status: string }>('/api/posts', { ...form, images });
      if (res.status === 'PENDING') {
        alert('发布成功! 帖子正在审核中, 通过后将显示在信息流。');
      }
      router.push('/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-center text-slate-400 py-10">加载中…</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">发布内容</h1>
      {err && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-3 card p-5">
        <div>
          <label className="text-sm text-slate-600">分类</label>
          <select className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600">标题</label>
          <input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={100} />
        </div>
        <div>
          <label className="text-sm text-slate-600">正文</label>
          <textarea className="input mt-1 min-h-[160px] resize-y" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required maxLength={5000} />
        </div>
        <div>
          <label className="text-sm text-slate-600">图片链接 (每行一个, 可留空)</label>
          <textarea className="input mt-1 min-h-[80px]" placeholder="https://…/1.jpg" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
          匿名发布
        </label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? '发布中…' : '发布'}</button>
      </form>
    </div>
  );
}
