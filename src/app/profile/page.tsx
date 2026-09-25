'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface MyPost { id: string; title: string; status: string; category: string; createdAt: string; likeCount: number; commentCount: number }

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [edit, setEdit] = useState({ nickname: '', avatar: '', studentId: '' });
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<'posts' | 'orders'>('posts');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadExtra = useCallback(async () => {
    if (!user) return;
    try {
      const [p, o] = await Promise.all([
        api.get<{ items: MyPost[] }>('/api/posts/my'),
        api.get<{ items: any[] }>('/api/payment/orders'),
      ]);
      setPosts(p.items);
      setOrders(o.items);
    } catch (e) { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) {
      setEdit({ nickname: user.nickname, avatar: user.avatar || '', studentId: '' });
      loadExtra();
    }
  }, [loading, user, loadExtra, router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await api.patch('/api/users/me', edit);
      setMsg('已保存');
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  if (loading || !user) return <p className="text-center text-slate-400 py-10">加载中…</p>;

  const STATUS_TEXT: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl font-bold">
            {user.nickname?.[0] || '?'}
          </div>
          <div>
            <div className="font-semibold text-lg">{user.nickname}</div>
            <div className="text-sm text-slate-500">{user.email} · {user.role === 'USER' ? '普通用户' : user.role === 'ADMIN' ? '管理员' : '超级管理员'}</div>
          </div>
        </div>
      </div>

      {/* 资料编辑 */}
      <form onSubmit={save} className="card p-5 space-y-3">
        <h2 className="font-semibold">编辑资料</h2>
        <input className="input" placeholder="昵称" value={edit.nickname} onChange={(e) => setEdit({ ...edit, nickname: e.target.value })} />
        <input className="input" placeholder="头像 URL" value={edit.avatar} onChange={(e) => setEdit({ ...edit, avatar: e.target.value })} />
        <input className="input" placeholder="学号" value={edit.studentId} onChange={(e) => setEdit({ ...edit, studentId: e.target.value })} />
        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={busy}>保存</button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
          <button type="button" className="btn-ghost ml-auto" onClick={() => { logout(); router.push('/'); }}>退出登录</button>
        </div>
      </form>

      {/* 我的帖子 / 订单 */}
      <div className="flex gap-2">
        <button className={`tag px-4 py-1.5 ${tab === 'posts' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('posts')}>我的帖子</button>
        <button className={`tag px-4 py-1.5 ${tab === 'orders' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('orders')}>我的订单</button>
      </div>

      {tab === 'posts' ? (
        <div className="space-y-2">
          {posts.length === 0 && <p className="card p-6 text-center text-slate-400 text-sm">还没有发布内容</p>}
          {posts.map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className="card p-3 block no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{p.title}</span>
                <span className="tag bg-slate-100 text-slate-500">{STATUS_TEXT[p.status] || p.status}</span>
                <span className="ml-auto text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.length === 0 && <p className="card p-6 text-center text-slate-400 text-sm">还没有订单</p>}
          {orders.map((o) => (
            <div key={o.id} className="card p-3 flex items-center gap-3 text-sm">
              <span className="tag bg-blue-50 text-blue-600">{o.type}</span>
              <span className="text-slate-600">{o.subject}</span>
              <span className="ml-auto text-slate-900 font-medium">¥{(o.amount / 100).toFixed(2)}</span>
              <span className={`tag ${o.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{o.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
