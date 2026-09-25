'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UserRole, PostStatus } from '@prisma/client';

type Tab = 'overview' | 'posts' | 'moderation' | 'comments' | 'orders' | 'users';
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
  const statusLabel: Record<string, string> = { NORMAL: '正常', GRADUATED: '毕业生', BANNED: '封禁' };
  const statusColor: Record<string, string> = { NORMAL: 'bg-green-100 text-green-700', GRADUATED: 'bg-amber-100 text-amber-700', BANNED: 'bg-red-100 text-red-700' };

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
                    <span className={`rounded px-1.5 py-0.5 text-xs ${statusColor[u.status] || 'bg-gray-100'}`}>{statusLabel[u.status] || u.status}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {u.realName ? u.realName + ' · ' : ''}{u.grade || ''}{u.className || ''}{u.email ? ' · ' + u.email : ''} · 帖子 {u._count?.posts}
                  </p>
                </div>
              </div>
              <button onClick={() => setEditUser(u)} className="rounded-lg bg-blue-50 px-4 py-1.5 text-xs text-blue-600 hover:bg-blue-100">编辑</button>
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

// ---------- 个人资料编辑 ----------
function EditProfile({ user, onSaved }: { user: any; onSaved: () => void }) {
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [realName, setRealName] = useState(user?.realName || '');
  const [grade, setGrade] = useState(user?.grade || '');
  const [className, setClassName] = useState(user?.className || '');
  const [remark, setRemark] = useState(user?.remark || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try { await api.patch('/api/users/me', { nickname, realName, grade, className, remark, avatar }); setMsg('已保存'); onSaved(); }
    catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const classOptions = grade ? CLASS_LIST : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (nickname[0] || 'U').toUpperCase()}
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
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">账号名</label>
        <input value={nickname} onChange={e => setNickname(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">真实姓名</label>
        <input value={realName} onChange={e => setRealName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">年级</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">不填写</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">班级</label>
          <select value={className} onChange={e => setClassName(e.target.value)} disabled={!grade} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
            <option value="">不填写</option>
            {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">备注</label>
        <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
    </div>
  );
}

// ---------- 主页面 ----------
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout, refreshUser } = useAuth();
  const [view, setView] = useState<View>('home');
  const [adminTab, setAdminTab] = useState<Tab>('overview');

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isSuper = user?.role === UserRole.SUPER_ADMIN;

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
        </div>
      </div>
    );
  }

  // ---- 编辑资料视图 ----
  if (view === 'edit' && user) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <EditProfile user={user} onSaved={() => { refreshUser?.(); }} />
        </div>
      </div>
    );
  }

  // ---- 首页视图 ----
  const menuItems = [
    { key: 'homepage', label: '我的主页', icon: '🏠' },
    { key: 'blacklist', label: '拉黑名单', icon: '🚫' },
    { key: 'feedback', label: '意见反馈', icon: '💬' },
    ...(isAdmin ? [{ key: 'admin', label: '管理后台', icon: '⚙️' }] : []),
    { key: 'about', label: '关于校园墙', icon: 'ℹ️' },
    { key: 'agreement', label: '用户协议', icon: '📄' },
    { key: 'privacy', label: '隐私政策', icon: '🔒' },
  ];

  const handleMenu = (key: string) => {
    if (key === 'admin') { setView('admin'); return; }
    if (key === 'homepage') { router.push(`/users/${user?.id}`); return; }
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
    </div>
  );
}
