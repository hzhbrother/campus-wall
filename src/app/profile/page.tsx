'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { UserRole, PostStatus } from '@prisma/client';

type Tab = 'profile' | 'overview' | 'posts' | 'moderation' | 'comments' | 'orders' | 'users';

// ---------- 通用 UI ----------
function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {desc && <p className="mt-1 text-sm text-gray-500">{desc}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  const label: Record<string, string> = { APPROVED: '已通过', PENDING: '待审核', REJECTED: '已拒绝' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{label[status] || status}</span>;
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  };
  const label: Record<string, string> = { PAID: '已支付', PENDING: '待支付', FAILED: '失败', CANCELLED: '已取消' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{label[status] || status}</span>;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('zh-CN'); } catch { return iso; }
}

// ---------- 数据概览 ----------
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/api/admin/stats').then(setStats).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-400">加载中…</div>;
  if (err) return <div className="py-8 text-center text-red-500">{err}</div>;

  return (
    <div>
      <SectionTitle title="数据概览" desc="平台核心运营数据" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="用户总数" value={stats.users} />
        <StatCard label="帖子总数" value={stats.posts} />
        <StatCard label="待审核" value={stats.pendingPosts} hint="需要处理的审核队列" />
        <StatCard label="评论总数" value={stats.comments} />
        <StatCard label="已支付订单" value={stats.paidOrders} />
        <StatCard label="累计收入 (元)" value={(stats.revenueCents / 100).toFixed(2)} />
      </div>
    </div>
  );
}

// ---------- 帖子管理 ----------
function PostsTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const pageSize = 10;

  const load = useCallback(() => {
    setLoading(true); setErr('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    api.get(`/api/admin/posts?${params}`).then((d: any) => { setPosts(d.items); setTotal(d.total); })
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [page, status, q]);

  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await api.patch(`/api/posts/${editId}`, { title: editTitle, content: editContent });
      setEditId(null); load();
    } catch (e: any) { setErr(e.message); }
  };

  const delPost = async (id: string) => {
    if (!confirm('确定删除该帖子吗？')) return;
    try { await api.del(`/api/posts/${id}`); load(); } catch (e: any) { setErr(e.message); }
  };

  const togglePin = async (p: any) => {
    try { await api.post(`/api/admin/posts/${p.id}/pin`, { pinned: !p.pinned }); load(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <div>
      <SectionTitle title="帖子管理" desc="编辑、删除、置顶任意帖子" />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          <option value="APPROVED">已通过</option>
          <option value="PENDING">待审核</option>
          <option value="REJECTED">已拒绝</option>
        </select>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="搜索标题/内容" className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}

      {editId && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-900">编辑帖子</h3>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="标题" />
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="内容" />
          <div className="flex gap-2">
            <button onClick={saveEdit} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">保存</button>
            <button onClick={() => setEditId(null)} className="rounded-lg bg-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-300">取消</button>
          </div>
        </div>
      )}

      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : posts.length === 0 ? (
        <p className="py-6 text-center text-gray-400">暂无帖子</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {p.pinned && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">置顶</span>}
                    <StatusBadge status={p.status} />
                    <h4 className="truncate font-semibold text-gray-900">{p.title}</h4>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.content}</p>
                  <p className="mt-2 text-xs text-gray-400">作者: {p.author?.nickname} · {fmtDate(p.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => { setEditId(p.id); setEditTitle(p.title); setEditContent(p.content); }} className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600 hover:bg-blue-100">编辑</button>
                  <button onClick={() => togglePin(p)} className={`rounded-lg px-3 py-1 text-xs ${p.pinned ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'} hover:opacity-80`}>{p.pinned ? '取消置顶' : '置顶'}</button>
                  <button onClick={() => delPost(p.id)} className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100">删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">上一页</button>
          <span className="text-sm text-gray-500">第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}

// ---------- 内容审核 ----------
function ModerationTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setErr('');
    api.get('/api/admin/moderation?page=1&pageSize=50').then((d: any) => setItems(d.items))
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const approve = async (id: string) => {
    try { await api.post(`/api/admin/posts/${id}/approve`); load(); } catch (e: any) { setErr(e.message); }
  };
  const reject = async (id: string) => {
    if (!reason.trim()) { alert('请输入拒绝理由'); return; }
    try { await api.post(`/api/admin/posts/${id}/reject`, { reason }); setRejectId(null); setReason(''); load(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <div>
      <SectionTitle title="内容审核" desc="审核待发布的帖子，通过或拒绝" />
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : items.length === 0 ? (
        <p className="py-6 text-center text-gray-400">审核队列已清空 🎉</p>
      ) : (
        <div className="space-y-3">
          {items.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="font-semibold text-gray-900">{p.title}</h4>
              <p className="mt-1 line-clamp-3 text-sm text-gray-600">{p.content}</p>
              <p className="mt-2 text-xs text-gray-400">作者: {p.author?.nickname} · {fmtDate(p.createdAt)}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => approve(p.id)} className="rounded-lg bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-700">通过</button>
                <button onClick={() => setRejectId(rejectId === p.id ? null : p.id)} className="rounded-lg bg-red-50 px-4 py-1.5 text-sm text-red-600 hover:bg-red-100">拒绝</button>
              </div>
              {rejectId === p.id && (
                <div className="mt-2 flex gap-2">
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="拒绝理由" className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  <button onClick={() => reject(p.id)} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700">确认拒绝</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 评论管理 ----------
function CommentsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const pageSize = 10;

  const load = useCallback(() => {
    setLoading(true); setErr('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set('q', q);
    api.get(`/api/admin/comments?${params}`).then((d: any) => { setItems(d.items); setTotal(d.total); })
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [page, q]);
  useEffect(load, [load]);

  const del = async (id: string) => {
    if (!confirm('确定删除该评论吗？')) return;
    try { await api.del(`/api/comments/${id}`); load(); } catch (e: any) { setErr(e.message); }
  };
  const save = async () => {
    if (!editId) return;
    try { await api.patch(`/api/comments/${editId}`, { content: editContent }); setEditId(null); load(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <div>
      <SectionTitle title="评论管理" desc="编辑、删除任意评论" />
      <div className="mb-4">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="搜索评论内容" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}

      {editId && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">保存</button>
            <button onClick={() => setEditId(null)} className="rounded-lg bg-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-300">取消</button>
          </div>
        </div>
      )}

      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : items.length === 0 ? (
        <p className="py-6 text-center text-gray-400">暂无评论</p>
      ) : (
        <div className="space-y-3">
          {items.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">{c.content}</p>
                  <p className="mt-1.5 text-xs text-gray-400">
                    用户: {c.author?.nickname} | 帖子: {c.post?.title} · {fmtDate(c.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => { setEditId(c.id); setEditContent(c.content); }} className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600 hover:bg-blue-100">编辑</button>
                  <button onClick={() => del(c.id)} className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100">删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">上一页</button>
          <span className="text-sm text-gray-500">第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}

// ---------- 支付明细 ----------
function OrdersTab() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const pageSize = 10;

  const load = useCallback(() => {
    setLoading(true); setErr('');
    api.get(`/api/admin/orders?page=${page}&pageSize=${pageSize}`).then((d: any) => { setItems(d.items); setTotal(d.total); })
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [page]);
  useEffect(load, [load]);

  const payLabel: Record<string, string> = { mock: '模拟支付', alipay: '支付宝', wechatpay: '微信支付' };

  return (
    <div>
      <SectionTitle title="支付明细" desc="所有订单记录，含用户、金额、支付方式、时间" />
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : items.length === 0 ? (
        <p className="py-6 text-center text-gray-400">暂无订单</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">订单号</th>
                <th className="px-4 py-3 text-left">用户</th>
                <th className="px-4 py-3 text-right">金额 (元)</th>
                <th className="px-4 py-3 text-left">支付方式</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o: any) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.orderNo}</td>
                  <td className="px-4 py-3">{o.user?.nickname || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{(o.amountCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">{payLabel[o.provider] || o.provider}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">上一页</button>
          <span className="text-sm text-gray-500">第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}

// ---------- 用户管理 ----------
function UsersTab({ isSuper }: { isSuper: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const pageSize = 10;

  const load = useCallback(() => {
    setLoading(true); setErr('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (role) params.set('role', role);
    if (q) params.set('q', q);
    api.get(`/api/admin/users?${params}`).then((d: any) => { setUsers(d.items); setTotal(d.total); })
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [page, role, q]);
  useEffect(load, [load]);

  const changeRole = async (id: string, r: UserRole) => {
    if (!confirm(`确认将该用户角色设为 ${r}？`)) return;
    try { await api.patch(`/api/admin/users/${id}/role`, { role: r }); load(); } catch (e: any) { setErr(e.message); }
  };
  const toggleBan = async (u: any) => {
    try { await api.post(`/api/admin/users/${u.id}/ban`, { banned: !u.banned }); load(); } catch (e: any) { setErr(e.message); }
  };

  const roleLabel: Record<string, string> = { USER: '普通用户', ADMIN: '管理员', SUPER_ADMIN: '超级管理员' };

  return (
    <div>
      <SectionTitle title="用户管理" desc={isSuper ? '管理所有用户的角色与封禁状态' : '查看用户列表；角色分配仅限超级管理员'} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部角色</option>
          <option value="USER">普通用户</option>
          <option value="ADMIN">管理员</option>
          <option value="SUPER_ADMIN">超级管理员</option>
        </select>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="搜索昵称/邮箱" className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : (
        <div className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{u.nickname || u.email}</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">{roleLabel[u.role] || u.role}</span>
                  {u.banned && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">已封禁</span>}
                </div>
                <p className="mt-0.5 text-xs text-gray-400">{u.email} · 注册于 {fmtDate(u.createdAt)} · 帖子 {u._count?.posts}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isSuper && u.role !== 'SUPER_ADMIN' && (
                  <select defaultValue={u.role} onChange={e => changeRole(u.id, e.target.value as UserRole)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                    <option value="USER">普通用户</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                )}
                <button onClick={() => toggleBan(u)} className={`rounded-lg px-3 py-1 text-xs ${u.banned ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} hover:opacity-80`}>
                  {u.banned ? '解封' : '封禁'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">上一页</button>
          <span className="text-sm text-gray-500">第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">下一页</button>
        </div>
      )}
    </div>
  );
}

// ---------- 个人信息 ----------
function ProfileSection({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const roleLabel: Record<string, string> = { USER: '普通用户', ADMIN: '管理员', SUPER_ADMIN: '超级管理员' };

  const save = async () => {
    setSaving(true); setMsg('');
    try { await api.patch('/api/users/me', { nickname, avatar, bio }); setMsg('已保存'); }
    catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <SectionTitle title="个人信息" />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (nickname[0] || 'U').toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user?.nickname || '用户'}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">{roleLabel[user?.role] || user?.role}</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">昵称</label>
          <input value={nickname} onChange={e => setNickname(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">头像 URL</label>
          <input value={avatar} onChange={e => setAvatar(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">简介</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
        <button onClick={onLogout} className="ml-3 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">退出登录</button>
      </div>
    </div>
  );
}

// ---------- 主页面 ----------
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>;
  if (!user) return null;

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const isSuper = user.role === UserRole.SUPER_ADMIN;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: '个人信息' },
    ...(isAdmin ? [
      { key: 'overview' as Tab, label: '数据概览' },
      { key: 'posts' as Tab, label: '帖子管理' },
      { key: 'moderation' as Tab, label: '内容审核' },
      { key: 'comments' as Tab, label: '评论管理' },
      { key: 'orders' as Tab, label: '支付明细' },
      { key: 'users' as Tab, label: '用户管理' },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">个人中心</h1>
        <p className="mb-6 text-sm text-gray-500">欢迎回来，{user.nickname}！</p>

        {/* 分栏 */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
              {tab === t.key && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {tab === 'profile' && <ProfileSection user={user} onLogout={() => { logout(); router.push('/'); }} />}
          {tab === 'overview' && isAdmin && <OverviewTab />}
          {tab === 'posts' && isAdmin && <PostsTab />}
          {tab === 'moderation' && isAdmin && <ModerationTab />}
          {tab === 'comments' && isAdmin && <CommentsTab />}
          {tab === 'orders' && isAdmin && <OrdersTab />}
          {tab === 'users' && isAdmin && <UsersTab isSuper={isSuper} />}
        </div>
      </div>
    </div>
  );
}
