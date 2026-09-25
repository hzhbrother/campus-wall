'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Stats { users: number; posts: number; pendingPosts: number; comments: number; paidOrders: number; revenueCents: number }
interface ModItem { id: string; title: string; content: string; category: string; createdAt: string; author: { nickname: string } }
interface UserItem { id: string; email: string | null; nickname: string; role: string; banned: boolean; createdAt: string; _count: { posts: number } }

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'stats' | 'moderation' | 'users'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [mod, setMod] = useState<ModItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))) {
      router.push('/');
    }
  }, [loading, user, router]);

  const loadStats = useCallback(async () => {
    try { setStats(await api.get<Stats>('/api/admin/stats')); } catch {}
  }, []);
  const loadMod = useCallback(async () => {
    try { const r = await api.get<{ items: ModItem[] }>('/api/admin/moderation'); setMod(r.items); } catch {}
  }, []);
  const loadUsers = useCallback(async () => {
    try { const r = await api.get<{ items: UserItem[] }>('/api/admin/users'); setUsers(r.items); } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    if (tab === 'stats') loadStats();
    if (tab === 'moderation') loadMod();
    if (tab === 'users') loadUsers();
  }, [user, tab, loadStats, loadMod, loadUsers]);

  const approve = async (id: string) => { await api.post(`/api/admin/posts/${id}/approve`); loadMod(); loadStats(); };
  const reject = async (id: string) => { await api.post(`/api/admin/posts/${id}/reject`); loadMod(); loadStats(); };
  const pin = async (id: string, pinned: boolean) => { await api.post(`/api/admin/posts/${id}/pin`, { pinned }); };
  const setRole = async (id: string, role: string) => { await api.patch(`/api/admin/users/${id}/role`, { role }); loadUsers(); };
  const ban = async (id: string, banned: boolean) => { await api.post(`/api/admin/users/${id}/ban`, { banned }); loadUsers(); };

  if (loading || !user) return <p className="text-center text-slate-400 py-10">加载中…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">管理后台 {isSuper ? '(超级管理员)' : '(管理员)'}</h1>

      <div className="flex gap-2">
        <button className={`tag px-4 py-1.5 ${tab === 'stats' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('stats')}>概览</button>
        <button className={`tag px-4 py-1.5 ${tab === 'moderation' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('moderation')}>审核队列 {stats?.pendingPosts ? `(${stats.pendingPosts})` : ''}</button>
        <button className={`tag px-4 py-1.5 ${tab === 'users' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'}`} onClick={() => setTab('users')}>用户管理</button>
      </div>

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['用户', stats.users], ['帖子', stats.posts], ['待审核', stats.pendingPosts],
            ['评论', stats.comments], ['已支付订单', stats.paidOrders], ['总收入', `¥${(stats.revenueCents / 100).toFixed(2)}`],
          ].map(([label, val]) => (
            <div key={label as string} className="card p-4">
              <div className="text-sm text-slate-500">{label}</div>
              <div className="text-2xl font-bold text-brand-600">{val}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'moderation' && (
        <div className="space-y-2">
          {mod.length === 0 && <p className="card p-6 text-center text-slate-400 text-sm">审核队列已清空 🎉</p>}
          {mod.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <span className="tag bg-blue-50 text-blue-600">{p.category}</span>
                <span>{p.author.nickname}</span>
                <span>{new Date(p.createdAt).toLocaleString('zh-CN')}</span>
                <Link href={`/post/${p.id}`} className="ml-auto text-brand-600 no-underline">查看</Link>
              </div>
              <div className="font-medium">{p.title}</div>
              <p className="text-sm text-slate-500 line-clamp-2">{p.content}</p>
              <div className="flex gap-2 mt-2">
                <button className="btn-primary text-xs px-3 py-1.5" onClick={() => approve(p.id)}>通过</button>
                <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => reject(p.id)}>驳回</button>
                <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => pin(p.id, true)}>置顶</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="card p-3 flex items-center gap-3 text-sm">
              <div className="font-medium w-24 truncate">{u.nickname}</div>
              <div className="text-slate-500 w-40 truncate text-xs">{u.email || '—'}</div>
              <div className="text-xs text-slate-400">帖 {u._count.posts}</div>
              <select
                className="input py-1 text-xs w-32"
                value={u.role}
                disabled={!isSuper}
                onChange={(e) => setRole(u.id, e.target.value)}
                title={isSuper ? '' : '仅超级管理员可改角色'}
              >
                <option value="USER">普通用户</option>
                <option value="ADMIN">管理员</option>
                <option value="SUPER_ADMIN">超级管理员</option>
              </select>
              <button
                className={u.banned ? 'btn-ghost text-xs px-3 py-1.5' : 'btn-ghost text-xs px-3 py-1.5 text-red-600'}
                onClick={() => ban(u.id, !u.banned)}
              >
                {u.banned ? '解封' : '封禁'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
