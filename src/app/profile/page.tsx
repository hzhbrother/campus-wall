'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UserRole, PostStatus } from '@prisma/client';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';

type Tab = 'overview' | 'posts' | 'moderation' | 'comments' | 'orders' | 'users' | 'notifications' | 'settings' | 'agreement';
type View = 'home' | 'admin' | 'edit' | Tab;

// ---------- 通用 UI ----------
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

  const cards = [
    { label: '用户总数', value: stats.users },
    { label: '帖子总数', value: stats.posts },
    { label: '待审核', value: stats.pendingPosts },
    { label: '评论总数', value: stats.comments },
    { label: '已支付订单', value: stats.paidOrders },
    { label: '累计收入(元)', value: (stats.revenueCents / 100).toFixed(2) },
  ];

  return (
    <div>
      <SectionTitle title="数据概览" desc="平台核心运营数据" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{c.value}</div>
          </div>
        ))}
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
    try { await api.patch(`/api/posts/${editId}`, { title: editTitle, content: editContent }); setEditId(null); load(); }
    catch (e: any) { setErr(e.message); }
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
          <option value="">全部状态</option><option value="APPROVED">已通过</option><option value="PENDING">待审核</option><option value="REJECTED">已拒绝</option>
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
            <button onClick={saveEdit} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white">保存</button>
            <button onClick={() => setEditId(null)} className="rounded-lg bg-gray-200 px-4 py-1.5 text-sm text-gray-700">取消</button>
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
                  <button onClick={() => { setEditId(p.id); setEditTitle(p.title); setEditContent(p.content); }} className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600">编辑</button>
                  <button onClick={() => togglePin(p)} className={`rounded-lg px-3 py-1 text-xs ${p.pinned ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-600'}`}>{p.pinned ? '取消置顶' : '置顶'}</button>
                  <button onClick={() => delPost(p.id)} className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600">删除</button>
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

  const approve = async (id: string) => { try { await api.post(`/api/admin/posts/${id}/approve`); load(); } catch (e: any) { setErr(e.message); } };
  const reject = async (id: string) => {
    if (!reason.trim()) { alert('请输入拒绝理由'); return; }
    try { await api.post(`/api/admin/posts/${id}/reject`, { reason }); setRejectId(null); setReason(''); load(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <div>
      <SectionTitle title="内容审核" desc="审核待发布的帖子" />
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
                <button onClick={() => approve(p.id)} className="rounded-lg bg-green-600 px-4 py-1.5 text-sm text-white">通过</button>
                <button onClick={() => setRejectId(rejectId === p.id ? null : p.id)} className="rounded-lg bg-red-50 px-4 py-1.5 text-sm text-red-600">拒绝</button>
              </div>
              {rejectId === p.id && (
                <div className="mt-2 flex gap-2">
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="拒绝理由" className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                  <button onClick={() => reject(p.id)} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white">确认拒绝</button>
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

  const del = async (id: string) => { if (!confirm('确定删除该评论吗？')) return; try { await api.del(`/api/comments/${id}`); load(); } catch (e: any) { setErr(e.message); } };
  const save = async () => { if (!editId) return; try { await api.patch(`/api/comments/${editId}`, { content: editContent }); setEditId(null); load(); } catch (e: any) { setErr(e.message); } };

  return (
    <div>
      <SectionTitle title="评论管理" desc="编辑、删除任意评论" />
      <div className="mb-4"><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="搜索评论内容" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
      {editId && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white">保存</button>
            <button onClick={() => setEditId(null)} className="rounded-lg bg-gray-200 px-4 py-1.5 text-sm text-gray-700">取消</button>
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
                  <p className="mt-1.5 text-xs text-gray-400">用户: {c.author?.nickname} | 帖子: {c.post?.title} · {fmtDate(c.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => { setEditId(c.id); setEditContent(c.content); }} className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600">编辑</button>
                  <button onClick={() => del(c.id)} className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600">删除</button>
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
      <SectionTitle title="支付明细" desc="所有订单记录" />
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
                <th className="px-4 py-3 text-right">金额(元)</th>
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
                  <td className="px-4 py-3 text-right font-semibold">{(o.amountCents / 100).toFixed(2)}</td>
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
  const [editUser, setEditUser] = useState<any>(null);
  const [banUser, setBanUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
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

  const roleLabel: Record<string, string> = { USER: '用户', STUDENT: '学生', TEACHER: '教师', ADMIN: '管理员', SUPER_ADMIN: '超级管理员' };
  const statusLabel: Record<string, string> = { NORMAL: '正常', GRADUATED: '毕业生', BANNED: '永久封禁' };
  const statusColor: Record<string, string> = { NORMAL: 'bg-green-100 text-green-700', GRADUATED: 'bg-amber-100 text-amber-700', BANNED: 'bg-red-600 text-white' };

  const isBanned = (u: any) => u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now();
  const userStatus = (u: any) => {
    if (u.status === 'BANNED') return { label: '永久封禁', color: 'bg-red-600 text-white' };
    if (isBanned(u)) return { label: '封禁中', color: 'bg-orange-500 text-white' };
    return { label: statusLabel[u.status] || u.status, color: statusColor[u.status] || 'bg-gray-100' };
  };
  const banInfo = (u: any) => {
    if (u.status === 'BANNED') return '永久封禁';
    if (isBanned(u)) return `临时封禁至 ${new Date(u.bannedUntil).toLocaleDateString()}`;
    return '';
  };

  return (
    <div>
      <SectionTitle title="用户管理" desc="编辑用户资料、状态与身份" />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部身份</option>
          <option value="STUDENT">学生</option><option value="TEACHER">教师</option>
          <option value="ADMIN">管理员</option><option value="SUPER_ADMIN">超级管理员</option>
        </select>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="搜索昵称/姓名/邮箱" className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : (
        <div className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                  {u.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : (u.nickname || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{u.nickname}</span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">{roleLabel[u.role] || u.role}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${userStatus(u).color}`}>{userStatus(u).label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {u.realName ? u.realName + ' · ' : ''}{u.grade || ''}{u.className || ''}{u.email ? ' · ' + u.email : ''} · 帖子 {u._count?.posts}
                  </p>
                  {banInfo(u) && <p className="mt-0.5 text-xs text-red-500 font-medium">{banInfo(u)}{u.banReason ? ' · ' + u.banReason : ''}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isBanned(u) && (
                  <button onClick={() => api.del(`/api/admin/users/${u.id}/ban`).then(() => load()).catch(e => setErr(e.message))} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-600 hover:bg-green-100">解封</button>
                )}
                <button onClick={() => setBanUser(u)} className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-100">封禁</button>
                <button onClick={() => setDeleteTarget(u)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">删除</button>
                <button onClick={() => setEditUser(u)} className="rounded-lg bg-blue-50 px-4 py-1.5 text-xs text-blue-600 hover:bg-blue-100">编辑</button>
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

      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={load} isSuper={isSuper} />}
      {banUser && <BanUserModal user={banUser} onClose={() => setBanUser(null)} onDone={load} />}
      {deleteTarget && <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={load} />}
    </div>
  );
}

// ---------- 编辑用户弹窗 ----------
const GRADES = ['高一', '高二', '高三', '初一', '初二', '初三'];
const CLASS_LIST = ['1班', '2班', '3班', '4班', '5班', '6班', '7班', '8班', '9班', '10班'];

function EditUserModal({ user, onClose, onSaved, isSuper }: { user: any; onClose: () => void; onSaved: () => void; isSuper: boolean }) {
  const [realName, setRealName] = useState(user.realName || '');
  const [grade, setGrade] = useState(user.grade || '');
  const [className, setClassName] = useState(user.className || '');
  const [remark, setRemark] = useState(user.remark || '');
  const [status, setStatus] = useState(user.status || 'NORMAL');
  const [role, setRole] = useState(user.role || 'STUDENT');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.patch(`/api/admin/users/${user.id}`, { realName, grade, className, remark, status, role, avatar });
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const classOptions = grade ? CLASS_LIST : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">编辑用户</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {err && <div className="mb-3 text-sm text-red-500">{err}</div>}

        <div className="space-y-3">
          {/* 头像 */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (user.nickname || 'U')[0]}
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100">
                选择文件
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </label>
              <label className="cursor-pointer rounded-lg bg-purple-50 px-3 py-1.5 text-xs text-purple-600 hover:bg-purple-100">
                拍照
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleAvatarFile} />
              </label>
            </div>
          </div>

          {/* 账号名（不可编辑） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号名</label>
            <input value={user.nickname} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
          </div>

          {/* 真实姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名</label>
            <input value={realName} onChange={e => setRealName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="请输入真实姓名" />
          </div>

          {/* 年级 + 班级 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">不填写</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
              <select value={className} onChange={e => setClassName(e.target.value)} disabled={!grade} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
                <option value="">不填写</option>
                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">访问状态</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="NORMAL">正常访问</option>
              <option value="GRADUATED">毕业生</option>
              <option value="BANNED">封禁</option>
            </select>
          </div>

          {/* 身份 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">身份</label>
            <select value={role} onChange={e => setRole(e.target.value)} disabled={!isSuper && user.role === 'SUPER_ADMIN'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
              <option value="STUDENT">学生</option>
              <option value="TEACHER">教师</option>
              <option value="ADMIN">管理员</option>
              {isSuper && <option value="SUPER_ADMIN">超级管理员</option>}
            </select>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="备注信息" />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 封禁用户弹窗 ----------
const BAN_OPTIONS = [
  { days: 7, label: '7 天', color: 'bg-blue-500 hover:bg-blue-600 text-white' },
  { days: 14, label: '14 天', color: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
  { days: 30, label: '30 天', color: 'bg-teal-500 hover:bg-teal-600 text-white' },
  { days: 60, label: '60 天', color: 'bg-green-500 hover:bg-green-600 text-white' },
  { days: 365, label: '1 年', color: 'bg-amber-500 hover:bg-amber-600 text-white' },
  { days: 730, label: '2 年', color: 'bg-orange-500 hover:bg-orange-600 text-white' },
  { days: 1825, label: '5 年', color: 'bg-red-400 hover:bg-red-500 text-white' },
  { days: 3650, label: '10 年', color: 'bg-red-500 hover:bg-red-600 text-white' },
  { days: 0, label: '永久', color: 'bg-red-800 hover:bg-red-900 text-white' },
];

const VIOLATION_TYPES = [
  { value: 'SPAM', label: '垃圾广告', points: 10 },
  { value: 'ABUSE', label: '辱骂攻击', points: 20 },
  { value: 'PORN', label: '色情低俗', points: 30 },
  { value: 'ILLEGAL', label: '违法违规', points: 50 },
  { value: 'PLAGIARISM', label: '抄袭侵权', points: 15 },
  { value: 'OTHER', label: '其他违规', points: 10 },
];

function BanUserModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [violationType, setViolationType] = useState('OTHER');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const selectedOpt = BAN_OPTIONS.find(o => o.days === selected);
  const selectedVType = VIOLATION_TYPES.find(v => v.value === violationType);

  const doBan = async () => {
    if (selected === null) return;
    setSaving(true); setErr('');
    try {
      await api.post(`/api/admin/users/${user.id}/ban`, { durationDays: selected, reason, violationType });
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 首次选择后进入确认弹窗
  const handleSelect = (days: number) => {
    setSelected(days);
    setConfirm(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {!confirm ? (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-1">封禁用户</h3>
            <p className="text-sm text-gray-500 mb-4">正在封禁: <span className="font-semibold text-gray-700">{user.nickname}</span></p>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-gray-600">违规类型 <span className="text-xs text-gray-400">(将同步扣除诚信分)</span></label>
              <div className="grid grid-cols-3 gap-2">
                {VIOLATION_TYPES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setViolationType(v.value)}
                    className={`rounded-lg border px-2 py-2 text-xs transition ${violationType === v.value ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}
                  >
                    <div className="font-medium">{v.label}</div>
                    <div className="mt-0.5 text-[10px] text-red-500">扣 {v.points} 分</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-gray-600">封禁原因 (可选)</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="例如: 恶意刷屏、发布违规内容..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-gray-600">选择封禁时长</label>
              <div className="grid grid-cols-3 gap-2">
                {BAN_OPTIONS.map(o => (
                  <button key={o.days} onClick={() => handleSelect(o.days)} className={`rounded-lg px-3 py-3 text-sm font-medium transition ${o.color}`}>{o.label}</button>
                ))}
              </div>
            </div>
            {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
            <button onClick={onClose} className="w-full rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-4">确认封禁</h3>
            <div className="mb-5 rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500">确定封禁用户</p>
              <p className="mt-1 font-bold text-gray-900">{user.nickname}</p>
              <p className="mt-2 text-sm text-gray-500">违规类型</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{selectedVType?.label}</p>
              <p className="mt-1 text-sm text-red-500">扣除诚信分 {selectedVType?.points} 分</p>
              <p className="mt-2 text-sm text-gray-500">封禁时间为</p>
              <p className={`mt-1 text-2xl font-bold ${selected === 0 ? 'text-red-800' : 'text-orange-600'}`}>{selectedOpt?.label}</p>
              {selected === 0 && <p className="mt-2 text-xs text-red-600">永久封禁后该用户将无法登录</p>}
              {selected !== 0 && <p className="mt-2 text-xs text-gray-500">封禁期间用户可浏览、点赞、收藏, 但不能发帖、评论</p>}
            </div>
            {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">返回</button>
              <button onClick={doBan} disabled={saving} className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white ${selected === 0 ? 'bg-red-800 hover:bg-red-900' : 'bg-orange-500 hover:bg-orange-600'} disabled:opacity-50`}>
                {saving ? '封禁中...' : '确定封禁'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- 删除用户确认弹窗 ----------
function DeleteConfirmModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const doDelete = async () => {
    setSaving(true); setErr('');
    try {
      await api.del(`/api/admin/users/${user.id}`);
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
        <p className="text-sm text-gray-600 mb-1">确定要删除用户 <span className="font-semibold text-gray-900">{user.nickname}</span> 吗？</p>
        <p className="text-xs text-red-500 mb-5">删除后不可恢复, 该用户的所有帖子、评论、点赞等数据将被一并删除。</p>
        {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
          <button onClick={doDelete} disabled={saving} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {saving ? '删除中...' : '确定删除'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 通知发布 (管理员) ----------
function NotificationSender() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('ALL');
  const [role, setRole] = useState('STUDENT');
  const [sendEmail, setSendEmail] = useState(false);
  const [type, setType] = useState('ANNOUNCE');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    if (!title.trim() || !content.trim()) { setMsg('请填写标题和内容'); return; }
    setSending(true); setMsg('');
    try {
      const body: any = { title, content, target, type, sendEmail };
      if (target === 'ROLE') body.role = role;
      await api.post('/api/admin/notifications', body);
      setMsg('通知发送成功！');
      setTitle(''); setContent('');
    } catch (e: any) { setMsg(e.message); } finally { setSending(false); }
  };

  return (
    <div>
      <SectionTitle title="发布通知" desc="向用户推送站内通知，可选同时发送邮件" />
      {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">通知类型</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="ANNOUNCE">公告</option>
            <option value="SYSTEM">系统通知</option>
            <option value="POST">帖子通知</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="通知标题" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="通知正文" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">发送对象</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={target === 'ALL'} onChange={() => setTarget('ALL')} /> 全体用户
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={target === 'ROLE'} onChange={() => setTarget('ROLE')} /> 按角色
            </label>
          </div>
          {target === 'ROLE' && (
            <select value={role} onChange={e => setRole(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="STUDENT">学生</option>
              <option value="TEACHER">教师</option>
              <option value="ADMIN">管理员</option>
            </select>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
          同时发送邮件通知（需配置 SMTP）
        </label>
        <button onClick={send} disabled={sending} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {sending ? '发送中…' : '发送通知'}
        </button>
      </div>
    </div>
  );
}

// ---------- 站点设置 (管理员) ----------
function SiteSettings() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    api.get('/api/admin/site-config').then(setCfg).catch(console.error).finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setCfg({ ...cfg, [k]: v });
  const bool = (k: string, def = true) => cfg[k] === undefined ? def : cfg[k] === 'true';
  const setBool = (k: string, v: boolean) => set(k, String(v));

  const save = async () => {
    setSaving(true); setMsg('');
    try { await api.patch('/api/admin/site-config', cfg); setMsg('保存成功'); }
    catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testEmail) { setTestMsg('请输入收件邮箱'); return; }
    setTesting(true); setTestMsg('');
    try {
      const r = await api.post<{ message?: string }>('/api/admin/site-config/test-email', { to: testEmail });
      setTestMsg(r.message || '已发送');
    } catch (e: any) { setTestMsg(e.message); } finally { setTesting(false); }
  };

  if (loading) return <p className="py-6 text-center text-gray-400">加载中…</p>;

  return (
    <div>
      <SectionTitle title="站点设置" desc="站点信息、SMTP 邮件、功能开关与内容配置" />
      {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      <div className="space-y-5">
        {/* 站点信息 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">🏷️ 站点信息</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">站点名称</label>
                <input value={cfg.site_name || ''} onChange={e => set('site_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="校园墙" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">站点域名</label>
                <input value={cfg.site_url || ''} onChange={e => set('site_url', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">站点描述</label>
              <input value={cfg.site_desc || ''} onChange={e => set('site_desc', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="校园信息交流平台" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">站点 Logo URL</label>
                <input value={cfg.site_logo || ''} onChange={e => set('site_logo', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO 关键词</label>
                <input value={cfg.site_keywords || ''} onChange={e => set('site_keywords', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="校园,墙,交流" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系邮箱</label>
                <input value={cfg.contact_email || ''} onChange={e => set('contact_email', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="admin@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ICP 备案号</label>
                <input value={cfg.site_icp || ''} onChange={e => set('site_icp', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="京ICP备xxxxxxxx号" />
              </div>
            </div>
          </div>
        </div>

        {/* SMTP */}
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">📧 SMTP 邮件配置</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP 服务器</label>
                <input value={cfg.smtp_host || ''} onChange={e => set('smtp_host', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="smtp.qq.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">端口</label>
                <input value={cfg.smtp_port || ''} onChange={e => set('smtp_port', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="465" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱账号</label>
                <input value={cfg.smtp_user || ''} onChange={e => set('smtp_user', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="xxx@qq.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">授权码/密码</label>
                <input type="password" value={cfg.smtp_pass || ''} onChange={e => set('smtp_pass', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="授权码" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">发件人</label>
                <input value={cfg.smtp_from || ''} onChange={e => set('smtp_from', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="校园墙 <xxx@qq.com>" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SSL</label>
                <select value={cfg.smtp_secure || 'true'} onChange={e => set('smtp_secure', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="true">开启 (465)</option>
                  <option value="false">关闭 (587)</option>
                </select>
              </div>
            </div>
            {/* 测试邮件 */}
            <div className="flex gap-2 pt-1">
              <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="输入收件邮箱测试" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button onClick={sendTest} disabled={testing} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{testing ? '发送中…' : '发送测试'}</button>
            </div>
            {testMsg && <p className={`text-xs ${testMsg.includes('成功') || testMsg.includes('已') ? 'text-green-600' : 'text-red-500'}`}>{testMsg}</p>}
          </div>
        </div>

        {/* 功能开关 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">⚙️ 功能开关</h3>
          <div className="space-y-3">
            {[
              { key: 'allow_register', label: '允许新用户注册', desc: '关闭后新用户无法注册账号' },
              { key: 'post_requires_approval', label: '发帖需审核', desc: '普通用户发帖需管理员审核通过' },
              { key: 'allow_anonymous', label: '允许匿名发帖', desc: '用户可选择匿名发布内容' },
              { key: 'comment_enabled', label: '允许评论', desc: '关闭后所有帖子不可评论' },
              { key: 'email_notify_enabled', label: '邮件通知', desc: '全局邮件推送开关' },
            ].map(it => (
              <label key={it.key} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{it.label}</div>
                  <div className="text-xs text-gray-400">{it.desc}</div>
                </div>
                <input type="checkbox" checked={bool(it.key)} onChange={e => setBool(it.key, e.target.checked)} className="h-5 w-5" />
              </label>
            ))}
          </div>
        </div>

        {/* 内容设置 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">📝 内容设置</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帖子分类（逗号分隔）</label>
              <textarea value={cfg.post_categories || ''} onChange={e => set('post_categories', e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="校园,失物招领,二手交易,表白墙,寻物启事,招聘兼职,求助问答" />
              <p className="text-xs text-gray-400 mt-1">修改后将影响发帖时的分类选项</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">每日发帖上限</label>
                <input type="number" min="0" value={cfg.daily_post_limit || ''} onChange={e => set('daily_post_limit', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0 = 不限制" />
              </div>
              <div className="flex items-end">
                <p className="text-xs text-gray-400">0 表示不限制，仅对普通用户生效</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">敏感词过滤（逗号分隔）</label>
              <textarea value={cfg.sensitive_words || ''} onChange={e => set('sensitive_words', e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="广告,诈骗,违规" />
              <p className="text-xs text-gray-400 mt-1">标题或内容包含敏感词时将无法发布</p>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? '保存中…' : '保存所有设置'}
        </button>
      </div>
    </div>
  );
}

// ---------- 协议管理 (管理员) ----------
function AgreementManager() {
  const [agreement, setAgreement] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>('/api/admin/site-config')
      .then(d => {
        setAgreement(d.agreement_content || '');
        setPrivacy(d.privacy_content || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.patch('/api/admin/site-config', { agreement_content: agreement, privacy_content: privacy });
      setMsg('保存成功');
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  if (loading) return <p className="py-6 text-center text-gray-400">加载中…</p>;

  return (
    <div>
      <SectionTitle title="协议管理" desc="编辑用户协议与隐私政策内容，支持纯文本格式" />
      {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      <div className="space-y-5">
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">📄 用户协议</h3>
            <span className="text-xs text-gray-400">{agreement.length} 字</span>
          </div>
          <textarea
            value={agreement}
            onChange={e => setAgreement(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed"
            placeholder="请输入用户协议内容..."
          />
        </div>

        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">🔒 隐私政策</h3>
            <span className="text-xs text-gray-400">{privacy.length} 字</span>
          </div>
          <textarea
            value={privacy}
            onChange={e => setPrivacy(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed"
            placeholder="请输入隐私政策内容..."
          />
        </div>

        <button onClick={save} disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? '保存中…' : '保存协议'}
        </button>
      </div>
    </div>
  );
}

// ---------- 个人资料编辑 (列表样式) ----------
function EditProfile({ user, onSaved, forcePhone = false }: { user: any; onSaved: () => void; forcePhone?: boolean }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [realName, setRealName] = useState(user?.realName || '');
  const [countryCode, setCountryCode] = useState(user?.countryCode || '+86');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [grade, setGrade] = useState(user?.grade || '');
  const [className, setClassName] = useState(user?.className || '');
  const [remark, setRemark] = useState(user?.remark || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const classOptions = grade ? CLASS_LIST : [];

  const save = async () => {
    setMsg(''); setPhoneError('');
    // 真实姓名必填
    if (!realName.trim()) { setMsg('请输入真实姓名'); return; }
    // 手机号必填 (按区号位数校验)
    const v = validatePhone(countryCode, phoneNumber);
    if (!v.ok) { setPhoneError(v.message || '请输入手机号'); return; }
    setSaving(true);
    try {
      await api.patch('/api/users/me', {
        nickname, realName: realName.trim(), countryCode, phoneNumber,
        grade, className, remark, avatar,
      });
      setMsg('已保存');
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const country = getCountryByCode(countryCode);

  // ---- 行组件 (左标签 + 右值/箭头) ----
  const Row = ({ label, children, onClick, border = true }: { label: React.ReactNode; children: React.ReactNode; onClick?: () => void; border?: boolean }) => (
    <div
      className={`flex items-center justify-between px-1 py-3.5 ${border ? 'border-b border-gray-100' : ''} ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      onClick={onClick}
    >
      <span className="text-[15px] text-gray-800">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );

  const Arrow = () => (
    <svg className="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );

  return (
    <div>
      {/* 头像行 */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100">
        <span className="text-[15px] text-gray-800">头像</span>
        <div className="relative">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (nickname[0] || 'U').toUpperCase()}
          </div>
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-blue-500 p-1 text-white shadow">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
          </label>
        </div>
      </div>

      {/* 强制模式提示 */}
      {forcePhone && (
        <p className="mt-3 text-xs text-orange-500">为保障账号安全, 请先完善真实姓名和手机号信息</p>
      )}

      {/* 昵称 */}
      <Row label="昵称">
        <input
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          className="w-32 text-right text-[15px] text-gray-900 outline-none"
          placeholder="请输入昵称"
        />
      </Row>

      {/* 手机号 (区号 + 号码) */}
      <div className="border-b border-gray-100 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-gray-800">
            手机号<span className="ml-1 text-red-500">*</span>
          </span>
          <div className="flex items-center gap-2">
            {/* 区号选择 */}
            <button
              type="button"
              onClick={() => setShowCountryPicker(true)}
              className="flex items-center gap-0.5 text-[15px] text-gray-900"
            >
              {country.code}
              <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <input
              type="tel"
              inputMode="numeric"
              value={phoneNumber}
              onChange={e => { setPhoneNumber(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
              className="w-28 text-right text-[15px] text-gray-900 outline-none"
              placeholder="请输入手机号"
              maxLength={Math.max(...country.lengths)}
            />
          </div>
        </div>
        {phoneError && <p className="mt-1 text-right text-xs text-red-500">{phoneError}</p>}
      </div>

      {/* 真实姓名 */}
      <Row label={<>真实姓名<span className="ml-1 text-red-500">*</span></>}>
        <input
          value={realName}
          onChange={e => setRealName(e.target.value)}
          className="w-32 text-right text-[15px] text-gray-900 outline-none"
          placeholder="请输入真实姓名"
        />
      </Row>

      {/* 年级 */}
      <Row label="年级" onClick={() => setEditingField(editingField === 'grade' ? null : 'grade')}>
        <span className={`text-[15px] ${grade ? 'text-gray-900' : 'text-gray-400'}`}>{grade || '不填写'}</span>
        <Arrow />
      </Row>
      {editingField === 'grade' && (
        <div className="px-1 py-2 border-b border-gray-100">
          <select value={grade} onChange={e => { setGrade(e.target.value); setClassName(''); setEditingField(null); }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <option value="">不填写</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      )}

      {/* 班级 */}
      <Row label="班级" onClick={() => grade && setEditingField(editingField === 'class' ? null : 'class')}>
        <span className={`text-[15px] ${className ? 'text-gray-900' : 'text-gray-400'}`}>{className || (grade ? '请选择' : '不填写')}</span>
        {grade && <Arrow />}
      </Row>
      {editingField === 'class' && grade && (
        <div className="px-1 py-2 border-b border-gray-100">
          <select value={className} onChange={e => { setClassName(e.target.value); setEditingField(null); }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <option value="">不填写</option>
            {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* 备注 (个人简介) */}
      <div className="py-3.5">
        <div className="mb-2 text-[15px] text-gray-800">个人简介</div>
        <textarea
          value={remark}
          onChange={e => setRemark(e.target.value.slice(0, 200))}
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="介绍一下自己吧..."
        />
        <div className="mt-1 text-right text-xs text-gray-400">{remark.length}/200</div>
      </div>

      {msg && <p className={`text-sm ${msg.includes('成功') || msg.includes('已保存') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}

      {/* 保存按钮 */}
      <button
        onClick={save}
        disabled={saving}
        className="mt-2 w-full rounded-full bg-blue-500 py-3.5 text-[15px] font-medium text-white hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? '保存中…' : '保存'}
      </button>

      {/* 退出登录 (非强制模式显示) */}
      {!forcePhone && (
        <button
          onClick={() => { if (confirm('确定退出登录吗？')) { logout(); router.push('/'); } }}
          className="mt-3 w-full rounded-full border border-red-400 py-3.5 text-[15px] font-medium text-red-500 hover:bg-red-50"
        >
          退出登录
        </button>
      )}

      {/* 区号选择面板 */}
      {showCountryPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowCountryPicker(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <h3 className="mb-4 text-center text-lg font-bold text-slate-900">选择国家/地区</h3>
            <div className="space-y-1">
              {COUNTRY_CODES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); setPhoneError(''); }}
                  className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left ${c.code === countryCode ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                >
                  <span className="text-sm text-gray-800">{c.name}</span>
                  <span className="text-sm text-gray-500">{c.code}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowCountryPicker(false)} className="mt-4 w-full rounded-xl bg-slate-100 py-3 text-sm text-slate-600">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 主页面 ----------
function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, logout, refreshUser } = useAuth();
  const [view, setView] = useState<View>('home');
  const [adminTab, setAdminTab] = useState<Tab>('overview');
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isSuper = user?.role === UserRole.SUPER_ADMIN;
  const forcePhone = searchParams.get('forcePhone') === '1';

  // URL 带 edit=1 时直接进入编辑模式 (用于强制填写手机号)
  useEffect(() => {
    if (searchParams.get('edit') === '1' && view === 'home') {
      setView('edit');
    }
  }, [searchParams, view]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>;

  const counts = (user as any)?._count || { posts: 0, comments: 0, likes: 0 };

  // ---- 管理后台视图 ----
  if (view !== 'home' && view !== 'edit') {
    const adminTabs: { key: Tab; label: string }[] = [
      { key: 'overview', label: '数据概览' },
      { key: 'posts', label: '帖子管理' },
      { key: 'moderation', label: '内容审核' },
      { key: 'comments', label: '评论管理' },
      { key: 'orders', label: '支付明细' },
      { key: 'users', label: '用户管理' },
      { key: 'notifications', label: '通知发布' },
      { key: 'settings', label: '站点设置' },
      { key: 'agreement', label: '协议管理' },
    ];
    const tab = view === 'admin' ? adminTab : view;
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>
        <div className="flex flex-wrap gap-2">
          {adminTabs.map(t => (
            <button key={t.key} onClick={() => { setAdminTab(t.key); setView(t.key); }}
              className={`px-3 py-1.5 rounded-full text-sm ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'posts' && <PostsTab />}
          {tab === 'moderation' && <ModerationTab />}
          {tab === 'comments' && <CommentsTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'users' && <UsersTab isSuper={isSuper} />}
          {tab === 'notifications' && <NotificationSender />}
          {tab === 'settings' && <SiteSettings />}
          {tab === 'agreement' && <AgreementManager />}
        </div>
      </div>
    );
  }

  // ---- 编辑资料视图 ----
  if (view === 'edit' && user) {
    return (
      <div className="space-y-4">
        {!forcePhone && (
          <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            返回
          </button>
        )}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <EditProfile
            user={user}
            forcePhone={forcePhone}
            onSaved={() => { refreshUser?.(); if (!forcePhone) setView('home'); else router.push('/'); }}
          />
        </div>
      </div>
    );
  }

  // ---- 首页视图 ----
  const menuItems = [
    { key: 'homepage', label: '我的主页', icon: '🏠' },
    { key: 'favorites', label: '我的收藏', icon: '⭐' },
    { key: 'password', label: '修改密码', icon: '🔑' },
    { key: 'notif-settings', label: '通知设置', icon: '🔔' },
    { key: 'blacklist', label: '拉黑名单', icon: '🚫' },
    { key: 'violations', label: '违规记录', icon: '📋' },
    { key: 'ban-appeal', label: '封禁申诉', icon: '✊' },
    { key: 'feedback', label: '意见反馈', icon: '💬' },
    ...(isAdmin ? [{ key: 'admin', label: '管理后台', icon: '⚙️' }] : []),
    { key: 'about', label: '关于校园墙', icon: 'ℹ️' },
    { key: 'agreement', label: '用户协议', icon: '📄' },
    { key: 'privacy', label: '隐私政策', icon: '🔒' },
  ];

  const handleMenu = (key: string) => {
    if (key === 'admin') { setView('admin'); return; }
    if (key === 'homepage') { router.push(`/users/${user?.id}`); return; }
    if (key === 'favorites') { router.push('/profile/favorites'); return; }
    if (key === 'violations') { router.push('/profile/violations'); return; }
    if (key === 'ban-appeal') { router.push('/profile/ban-appeal'); return; }
    if (key === 'password') { setShowPwdModal(true); return; }
    if (key === 'notif-settings') { setShowNotifModal(true); return; }
    if (key === 'agreement') { router.push('/agreement'); return; }
    if (key === 'privacy') { router.push('/privacy'); return; }
    if (key === 'about') { router.push('/about'); return; }
    alert(`「${menuItems.find(m => m.key === key)?.label}」功能开发中…`);
  };

  return (
    <div className="space-y-4">
      {/* 蓝色渐变头部 */}
      <div className="-mx-4 -mt-3 px-4 pt-6 pb-12 bg-gradient-to-b from-blue-500 to-blue-400">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-white/30 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white/40">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.nickname || 'U')[0].toUpperCase()
            )}
          </div>
          <div className="flex-1">
            {user ? (
              <>
                <div className="text-lg font-bold text-white">{user.nickname}</div>
                <div className="text-sm text-white/80">{user.email || '未绑定邮箱'}</div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-white">未登录</div>
                <div className="text-sm text-white/80">登录后查看更多内容</div>
              </>
            )}
          </div>
          {user ? (
            <button onClick={() => setView('edit')} className="rounded-full bg-white/20 px-3 py-1.5 text-sm text-white">编辑</button>
          ) : (
            <button onClick={() => router.push('/login')} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-blue-600">立即登录 / 注册</button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="-mt-8 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '帖子', value: counts.posts, color: 'text-purple-500' },
            { label: '评论', value: counts.comments, color: 'text-pink-500' },
            { label: '收藏', value: 0, color: 'text-red-500' },
            { label: '赞过', value: counts.likes, color: 'text-blue-500' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-2">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 菜单列表 */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {menuItems.map((item, i) => (
          <button
            key={item.key}
            onClick={() => handleMenu(item.key)}
            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="flex-1 text-sm text-gray-800">{item.label}</span>
            <svg className="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>

      {/* 退出登录 */}
      {user && (
        <button
          onClick={() => { logout(); router.push('/'); }}
          className="w-full rounded-2xl bg-white py-3.5 text-sm text-red-500 shadow-sm hover:bg-gray-50"
        >
          退出登录
        </button>
      )}

      {/* 修改密码弹窗 */}
      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}

      {/* 通知设置弹窗 */}
      {showNotifModal && <NotificationSettingsModal onClose={() => setShowNotifModal(false)} />}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}

// ---------- 修改密码弹窗 ----------
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (newPwd !== confirmPwd) { setMsg('两次输入的密码不一致'); return; }
    if (newPwd.length < 6) { setMsg('密码至少6位'); return; }
    setBusy(true); setMsg('');
    try {
      await api.post('/api/users/me/change-password', { oldPassword: oldPwd, newPassword: newPwd });
      setMsg('密码修改成功');
      setTimeout(onClose, 1000);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">修改密码</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        {msg && <p className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
        <div className="space-y-3">
          <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} placeholder="原密码" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="新密码 (至少6位)" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
          <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="确认新密码" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={submit} disabled={busy} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? '提交中…' : '确认修改'}</button>
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700">取消</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 通知设置弹窗 ----------
function NotificationSettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/users/me/notification-settings').then(setSettings).catch(console.error);
  }, []);

  const toggle = (k: string) => {
    if (!settings) return;
    setSettings({ ...settings, [k]: !settings[k] });
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try { await api.patch('/api/users/me/notification-settings', settings); setMsg('保存成功'); }
    catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const items = [
    { key: 'emailNotify', label: '邮件通知', desc: '通过邮件接收通知' },
    { key: 'systemNotify', label: '系统通知', desc: '站内系统消息' },
    { key: 'commentNotify', label: '评论通知', desc: '有人回复你的帖子' },
    { key: 'likeNotify', label: '点赞通知', desc: '有人点赞你的帖子' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">通知设置</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        {msg && <p className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
        {!settings ? <p className="py-4 text-center text-sm text-gray-400">加载中…</p> : (
          <div className="space-y-2">
            {items.map(it => (
              <label key={it.key} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{it.label}</div>
                  <div className="text-xs text-gray-400">{it.desc}</div>
                </div>
                <input type="checkbox" checked={settings[it.key]} onChange={() => toggle(it.key)} className="h-5 w-5" />
              </label>
            ))}
          </div>
        )}
        <button onClick={save} disabled={saving} className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
      </div>
    </div>
  );
}
