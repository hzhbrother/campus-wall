'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { PERMISSIONS, PERMISSIONS_BY_GROUP, SUPER_ADMIN_ONLY_PERMISSIONS } from '@/lib/permissions';
import TemplateManager from './TemplateManager';

export type AdminTab = 'overview' | 'posts' | 'moderation' | 'comments' | 'users' | 'verification' | 'template' | 'appeals' | 'notifications' | 'settings' | 'email' | 'agreement' | 'roles';

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
  ];

  return (
    <div>
      <SectionTitle title="数据概览" desc="平台核心运营数据" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
const REJECT_VIOLATION_TYPES = [
  { value: 'SPAM', label: '垃圾广告', points: 10 },
  { value: 'ABUSE', label: '辱骂攻击', points: 20 },
  { value: 'PORN', label: '色情低俗', points: 30 },
  { value: 'ILLEGAL', label: '违法违规', points: 50 },
  { value: 'PLAGIARISM', label: '抄袭侵权', points: 15 },
];

function ModerationTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [violationType, setViolationType] = useState('SPAM');
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
    try { await api.post(`/api/admin/posts/${id}/reject`, { reason, violationType }); setRejectId(null); setReason(''); setViolationType('SPAM'); load(); } catch (e: any) { setErr(e.message); }
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
                <div className="mt-3 space-y-3 rounded-xl bg-red-50/50 p-3">
                  <div>
                    <label className="mb-1.5 block text-sm text-gray-600">违规类型 <span className="text-xs text-gray-400">(将同步扣除作者诚信分)</span></label>
                    <div className="grid grid-cols-3 gap-2">
                      {REJECT_VIOLATION_TYPES.map(v => (
                        <button
                          key={v.value}
                          onClick={() => setViolationType(v.value)}
                          className={`rounded-lg border px-2 py-2 text-xs transition ${violationType === v.value ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'}`}
                        >
                          <div className="font-medium">{v.label}</div>
                          <div className="mt-0.5 text-[10px] text-red-500">扣 {v.points} 分</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="拒绝理由 (将通知作者)" className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
                    <button onClick={() => reject(p.id)} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white">确认拒绝</button>
                  </div>
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
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const isBanned = (u: any) => {
    if (!u.bannedUntil) return false;
    try { return new Date(u.bannedUntil).getTime() > Date.now(); } catch { return false; }
  };
  const userStatus = (u: any) => {
    if (u.status === 'BANNED') return { label: '永久封禁', color: 'bg-red-600 text-white' };
    if (isBanned(u)) return { label: '封禁中', color: 'bg-orange-500 text-white' };
    return { label: statusLabel[u.status] || u.status, color: statusColor[u.status] || 'bg-gray-100' };
  };
  const banInfo = (u: any) => {
    if (u.status === 'BANNED') return '永久封禁';
    if (isBanned(u)) {
      try { return `临时封禁至 ${new Date(u.bannedUntil).toLocaleDateString()}`; } catch { return '临时封禁中'; }
    }
    return '';
  };
  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : s >= 40 ? 'text-orange-600' : 'text-red-600';

  return (
    <div>
      <SectionTitle title="用户管理" desc="编辑用户资料、状态与身份" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部身份</option>
          <option value="STUDENT">学生</option><option value="TEACHER">教师</option>
          <option value="ADMIN">管理员</option><option value="SUPER_ADMIN">超级管理员</option>
        </select>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="搜索昵称/姓名/邮箱" className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">新增用户</button>
          <button onClick={() => setShowImport(true)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Excel 导入</button>
          {selected.size > 0 && (
            <button onClick={() => setShowBatch(true)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">批量更新 ({selected.size})</button>
          )}
        </div>
      </div>
      {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
      {loading ? <p className="py-6 text-center text-gray-400">加载中…</p> : (
        <div className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={e => {
                    const ns = new Set(selected);
                    if (e.target.checked) ns.add(u.id); else ns.delete(u.id);
                    setSelected(ns);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                  {u.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : (u.nickname || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{u.nickname}</span>
                    {u.verified ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>已认证</span>
                    ) : u.verificationStatus === 'PENDING' ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">待审核</span>
                    ) : u.verificationStatus === 'REJECTED' ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">已驳回</span>
                    ) : null}
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">{u.customRole?.name || roleLabel[u.role] || u.role}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${userStatus(u).color}`}>{userStatus(u).label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {u.realName ? u.realName + ' · ' : ''}{u.grade || ''}{u.className || ''}{u.email ? ' · ' + u.email : ''} · 帖子 {u._count?.posts}
                    {typeof u.credibilityScore === 'number' && <span className={`ml-2 font-medium ${scoreColor(u.credibilityScore)}`}>诚信分 {u.credibilityScore}</span>}
                  </p>
                  {banInfo(u) && <p className="mt-0.5 text-xs text-red-500 font-medium">{banInfo(u)}{u.banReason ? ' · ' + u.banReason : ''}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isBanned(u) && (
                  <button onClick={() => api.del(`/api/admin/users/${u.id}/ban`).then(() => load()).catch(e => setErr(e.message))} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-600 hover:bg-green-100">解封</button>
                )}
                <button onClick={() => setBanUser(u)} className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-100">封禁</button>
                {isSuper && <button onClick={() => setDeleteTarget(u)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">删除</button>}
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
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onDone={load} isSuper={isSuper} />}
      {showBatch && <BatchUpdateModal selectedIds={selected} onClose={() => setShowBatch(false)} onDone={() => { load(); setSelected(new Set()); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={load} />}
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
  // 角色选择值: 系统角色直接用枚举; 自定义角色用 "custom:<id>"
  const [roleVal, setRoleVal] = useState(user.roleId ? `custom:${user.roleId}` : (user.role || 'STUDENT'));
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string }[]>([]);
  const [verified, setVerified] = useState(!!user.verified);
  const [rejectReason, setRejectReason] = useState('');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const vStatus = user.verificationStatus || 'NONE';
  const isPending = vStatus === 'PENDING';

  useEffect(() => {
    api.get<{ roles: { id: string; name: string; isSystem: boolean }[] }>('/api/admin/roles')
      .then(data => setCustomRoles(data.roles.filter(r => !r.isSystem)))
      .catch(() => {});
  }, []);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 压缩/缩放头像, 避免手机拍照产生的超大 base64 拖慢保存
    const img = new Image();
    img.onload = () => {
      const max = 256;
      let { width, height } = img;
      if (width > height && width > max) { height = Math.round(height * max / width); width = max; }
      else if (height > max) { width = Math.round(width * max / height); height = max; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      setAvatar(canvas.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const payload: any = { realName, grade, className, remark, status, verified };
      // 仅头像有变更时才上传, 避免无谓的大体积请求
      if (avatar !== (user.avatar || '')) payload.avatar = avatar;
      // 角色: 系统角色 or 自定义角色
      if (roleVal.startsWith('custom:')) {
        payload.roleId = roleVal.slice(7);
      } else {
        payload.role = roleVal;
        payload.roleId = null;
      }
      // 认证状态处理
      if (isPending) {
        if (verified) {
          payload.verificationStatus = 'APPROVED';
        } else {
          payload.verificationStatus = 'REJECTED';
          payload.verificationRejectReason = rejectReason.trim() || '照片不清晰或信息不全';
        }
      } else if (verified !== !!user.verified) {
        // 非待审核状态下的手动操作 (跳过照片审核)
        payload.verificationStatus = verified ? 'APPROVED' : 'NONE';
      }
      await api.patch(`/api/admin/users/${user.id}`, payload);
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

        {/* 封禁状态提示 */}
        {(() => {
          const isPerm = user.status === 'BANNED';
          const isTemp = user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now();
          if (!isPerm && !isTemp) return null;
          return (
            <div className={`mb-3 rounded-lg p-3 text-sm ${isPerm ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
              <span className="font-semibold">{isPerm ? '⚠ 永久封禁中' : '⚠ 临时封禁中'}</span>
              {isTemp && user.bannedUntil && ` · 到期: ${new Date(user.bannedUntil).toLocaleString('zh-CN')}`}
              {user.banReason && ` · 原因: ${user.banReason}`}
              <div className="mt-1 text-xs opacity-80">修改访问状态不会解除封禁, 如需解封请在用户列表点击「解封」按钮。</div>
            </div>
          );
        })()}

        <div className="space-y-3">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号名</label>
            <input value={user.nickname} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名</label>
            <input value={realName} onChange={e => setRealName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="请输入真实姓名" />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">访问状态</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="NORMAL">正常访问</option>
              <option value="GRADUATED">毕业生</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">封禁用户请使用列表中的「封禁」按钮 (将同步扣除诚信分)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">身份</label>
            <select value={roleVal} onChange={e => setRoleVal(e.target.value)} disabled={!isSuper && user.role === 'SUPER_ADMIN'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
              <optgroup label="系统角色">
                <option value="STUDENT">学生</option>
                <option value="TEACHER">教师</option>
                <option value="ADMIN">管理员</option>
                <option value="USER">用户</option>
                {isSuper && <option value="SUPER_ADMIN">超级管理员</option>}
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="自定义角色">
                  {customRoles.map(r => (
                    <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="rounded-lg border border-gray-200 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div className="pr-3">
                <div className="text-sm font-medium text-gray-700">认证状态</div>
                <div className="text-xs text-gray-400">
                  {isPending
                    ? '该用户已提交认证申请, 可直接通过或驳回'
                    : verified
                      ? '已认证, 用户可发帖并在主页显示「已认证」标识'
                      : '未认证, 用户无法发帖。需用户在个人中心提交认证申请后, 在「实名认证审核」中人工审核通过。'}
                </div>
              </div>
              {isPending ? (
                <button
                  type="button"
                  onClick={() => setVerified(v => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${verified ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${verified ? 'translate-x-5' : ''}`} />
                </button>
              ) : verified ? (
                <button
                  type="button"
                  onClick={() => { if (confirm('确认取消该用户的认证? 取消后用户将无法发帖。')) setVerified(false); }}
                  className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200"
                >
                  取消认证
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { if (confirm('手动通过认证将跳过校园卡照片审核, 确认继续?')) setVerified(true); }}
                  className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100"
                >
                  手动通过认证
                </button>
              )}
            </div>
            {isPending && verified === false && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">驳回原因 (将通知用户)</label>
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="如: 照片不清晰或信息不全" />
              </div>
            )}
          </div>

          {/* 待审核: 显示校园卡照片 */}
          {isPending && user.verificationPhoto && (
            <div>
              <div className="text-xs text-gray-500 mb-1">认证照片</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.verificationPhoto} alt="认证材料" className="w-full rounded-lg border border-gray-200" />
            </div>
          )}

          {/* 已驳回: 显示原因 */}
          {vStatus === 'REJECTED' && user.verificationRejectReason && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              上次驳回原因: {user.verificationRejectReason}
            </div>
          )}

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
  { days: 1, label: '1 天', color: 'bg-sky-500 hover:bg-sky-600 text-white' },
  { days: 3, label: '3 天', color: 'bg-blue-500 hover:bg-blue-600 text-white' },
  { days: 7, label: '7 天', color: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
  { days: 14, label: '14 天', color: 'bg-teal-500 hover:bg-teal-600 text-white' },
  { days: 30, label: '30 天', color: 'bg-green-500 hover:bg-green-600 text-white' },
  { days: 0, label: '永久', color: 'bg-red-800 hover:bg-red-900 text-white' },
];

const VIOLATION_TYPES = [
  { value: 'SPAM', label: '垃圾广告', points: 10 },
  { value: 'ABUSE', label: '辱骂攻击', points: 20 },
  { value: 'PORN', label: '色情低俗', points: 30 },
  { value: 'ILLEGAL', label: '违法违规', points: 50 },
  { value: 'PLAGIARISM', label: '抄袭侵权', points: 15 },
];

function BanUserModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<number | null>(1);
  const [reason, setReason] = useState('');
  const [violationType, setViolationType] = useState('SPAM');
  const [customType, setCustomType] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // 自定义时长
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDays, setCustomDays] = useState(0);
  const [customHours, setCustomHours] = useState(0);
  // 自定义扣分
  const [useCustomPoints, setUseCustomPoints] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);

  const selectedOpt = BAN_OPTIONS.find(o => o.days === selected);
  const selectedVType = VIOLATION_TYPES.find(v => v.value === violationType);

  // 最终生效的封禁天数/小时/扣分
  const isPermanent = selected === 0;
  const isCustom = useCustomDuration;
  const finalDays = isCustom ? customDays : (selected || 0);
  const finalHours = isCustom ? customHours : 0;
  const finalPoints = useCustomPoints
    ? Math.min(100, Math.max(5, Math.round(customPoints)))
    : (selectedVType?.points || 10);

  const durationLabel = isPermanent
    ? '永久'
    : isCustom
      ? `${finalDays} 天 ${finalHours} 小时`
      : selectedOpt?.label || '';

  const goConfirm = () => {
    if (isCustom && finalDays <= 0 && finalHours <= 0) {
      setErr('自定义时长至少需要 1 小时');
      return;
    }
    setErr('');
    setConfirm(true);
  };

  const doBan = async () => {
    setSaving(true); setErr('');
    try {
      await api.post(`/api/admin/users/${user.id}/ban`, {
        durationDays: finalDays,
        durationHours: finalHours,
        reason,
        violationType,
        pointsDeducted: useCustomPoints ? finalPoints : undefined,
      });
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (days: number) => {
    setSelected(days);
    setUseCustomDuration(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {!confirm ? (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-1">封禁用户</h3>
            <p className="text-sm text-gray-500 mb-4">正在封禁: <span className="font-semibold text-gray-700">{user.nickname}</span></p>

            {/* 违规类型 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-gray-600">违规类型 <span className="text-xs text-gray-400">（可选择推荐类型或自定义输入）</span></label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {VIOLATION_TYPES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => { setViolationType(v.value); setCustomType(''); setUseCustomPoints(false); }}
                    className={`rounded-lg border px-2 py-2 text-xs transition ${violationType === v.value && !customType ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}
                  >
                    <div className="font-medium">{v.label}</div>
                    <div className="mt-0.5 text-[10px] text-red-500">扣 {v.points} 分</div>
                  </button>
                ))}
              </div>
              <input
                value={customType}
                onChange={e => { const v = e.target.value; setCustomType(v); setViolationType(v || 'SPAM'); }}
                placeholder="或输入自定义违规类型..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              />
            </div>

            {/* 自定义扣分 */}
            <div className="mb-4 rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={useCustomPoints}
                  onChange={e => setUseCustomPoints(e.target.checked)}
                  className="h-4 w-4"
                />
                自定义扣除诚信分
                <span className="text-xs text-gray-400">(5 - 100 分)</span>
              </label>
              {useCustomPoints && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={customPoints}
                    onChange={e => setCustomPoints(Number(e.target.value))}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <span className="text-sm text-gray-500">分</span>
                  <span className="text-xs text-gray-400 ml-auto">实际扣除: {finalPoints} 分</span>
                </div>
              )}
            </div>

            {/* 封禁时长 */}
            <div className="mb-4">
              <label className="mb-2 block text-sm text-gray-600">选择封禁时长</label>
              <div className="grid grid-cols-3 gap-2">
                {BAN_OPTIONS.map(o => (
                  <button
                    key={o.days}
                    onClick={() => handleSelect(o.days)}
                    className={`rounded-lg px-3 py-3 text-sm font-medium transition ${selected === o.days && !useCustomDuration ? 'ring-2 ring-offset-2 ring-orange-400 ' : ''}${o.color}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义时长 */}
            <div className="mb-4 rounded-lg border border-gray-200 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={useCustomDuration}
                  onChange={e => setUseCustomDuration(e.target.checked)}
                  className="h-4 w-4"
                />
                自定义封禁时长
                <span className="text-xs text-gray-400">(天 + 小时)</span>
              </label>
              {useCustomDuration && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={customDays}
                      onChange={e => setCustomDays(Math.max(0, Number(e.target.value)))}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center"
                    />
                    <span className="text-sm text-gray-600">天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={customHours}
                      onChange={e => setCustomHours(Math.min(23, Math.max(0, Number(e.target.value))))}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center"
                    />
                    <span className="text-sm text-gray-600">小时</span>
                  </div>
                  <p className="w-full text-xs text-gray-400">天可填 0, 小时 0-23, 总时长需大于 0</p>
                </div>
              )}
            </div>

            {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
              <button onClick={goConfirm} className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600">确定</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900 mb-4">确认封禁</h3>
            <div className="mb-5 rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500">确定封禁用户</p>
              <p className="mt-1 font-bold text-gray-900">{user.nickname}</p>
              <p className="mt-2 text-sm text-gray-500">违规类型</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{selectedVType?.label || violationType}</p>
              <p className="mt-1 text-sm text-red-500">扣除诚信分 {finalPoints} 分</p>
              <p className="mt-2 text-sm text-gray-500">封禁时间为</p>
              <p className={`mt-1 text-2xl font-bold ${isPermanent ? 'text-red-800' : 'text-orange-600'}`}>{durationLabel}</p>
              {isPermanent && <p className="mt-2 text-xs text-red-600">永久封禁后该用户将无法登录</p>}
              {!isPermanent && <p className="mt-2 text-xs text-gray-500">封禁期间用户可浏览、点赞、收藏, 但不能发帖、评论</p>}
            </div>
            {err && <div className="mb-3 text-sm text-red-500">{err}</div>}
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">返回</button>
              <button onClick={doBan} disabled={saving} className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white ${isPermanent ? 'bg-red-800 hover:bg-red-900' : 'bg-orange-500 hover:bg-orange-600'} disabled:opacity-50`}>
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

// ---------- 新增用户弹窗 ----------
function CreateUserModal({ onClose, onDone, isSuper }: { onClose: () => void; onDone: () => void; isSuper: boolean }) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [roleVal, setRoleVal] = useState('STUDENT');
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState('NORMAL');
  const [remark, setRemark] = useState('');
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    api.get<{ roles: { id: string; name: string; isSystem: boolean }[] }>('/api/admin/roles')
      .then(data => setCustomRoles(data.roles.filter(r => !r.isSystem)))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setErr(''); setResult('');
    try {
      const body: any = {};
      if (email.trim()) body.email = email.trim();
      if (nickname.trim()) body.nickname = nickname.trim();
      if (password.trim()) body.password = password.trim();
      if (realName.trim()) body.realName = realName.trim();
      if (grade.trim()) body.grade = grade.trim();
      if (className.trim()) body.className = className.trim();
      if (remark.trim()) body.remark = remark.trim();
      // 角色: 自定义 or 系统
      if (roleVal.startsWith('custom:')) {
        body.roleId = roleVal.slice(7);
      } else {
        body.role = roleVal;
      }
      body.status = status;
      body.verified = verified;
      const res: any = await api.post('/api/admin/users', body);
      setResult(res.message || '创建成功');
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 pb-8 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">新增用户</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">昵称 (留空自动生成)</label><input value={nickname} onChange={e => setNickname(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="如 张三" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">邮箱 (可选)</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="可选" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">密码 (留空默认 123456)</label><input value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="可选, 至少6位" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">真实姓名 (可选)</label><input value={realName} onChange={e => setRealName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="可选" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">年级 (可选)</label><input value={grade} onChange={e => setGrade(e.target.value)} list="grades" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="可选" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">班级 (可选)</label><input value={className} onChange={e => setClassName(e.target.value)} list="classes" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="可选" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">身份</label><select value={roleVal} onChange={e => setRoleVal(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <optgroup label="系统角色">
              <option value="STUDENT">学生</option><option value="TEACHER">教师</option><option value="USER">用户</option><option value="ADMIN">管理员</option>{isSuper && <option value="SUPER_ADMIN">超级管理员</option>}
            </optgroup>
            {customRoles.length > 0 && (
              <optgroup label="自定义角色">
                {customRoles.map(r => <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>)}
              </optgroup>
            )}
          </select></div>
          <div><label className="block text-xs text-gray-500 mb-1">状态</label><select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="NORMAL">正常</option><option value="GRADUATED">毕业生</option><option value="BANNED">封禁</option></select></div>
          <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">备注 (可选)</label><input value={remark} onChange={e => setRemark(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="可选" /></div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="verified-create" checked={verified} onChange={e => setVerified(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            <label htmlFor="verified-create" className="text-sm text-gray-600">已认证 (管理员身份默认已认证)</label>
          </div>
        </div>
        <datalist id="grades"><option value="高一" /><option value="高二" /><option value="高三" /><option value="初一" /><option value="初二" /><option value="初三" /></datalist>
        <datalist id="classes"><option value="1班" /><option value="2班" /><option value="3班" /><option value="4班" /><option value="5班" /><option value="6班" /></datalist>
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        {result && <p className="mt-3 text-sm text-green-600">{result}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">关闭</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '创建中…' : '创建用户'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 批量更新弹窗 ----------
function BatchUpdateModal({ selectedIds, onClose, onDone }: { selectedIds: Set<string>; onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [verified, setVerified] = useState<string>('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState('');

  const save = async () => {
    setSaving(true); setErr(''); setResult('');
    const items = Array.from(selectedIds).map(userId => {
      const item: any = { userId };
      if (role) item.role = role;
      if (status) item.status = status;
      if (grade !== undefined) item.grade = grade;
      if (className !== undefined) item.className = className;
      if (remark !== undefined) item.remark = remark;
      if (verified !== '') item.verified = verified === 'true';
      return item;
    });
    try {
      const res: any = await api.post('/api/admin/users/batch', { items });
      setResult(res.message || '更新成功');
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">批量更新 ({selectedIds.size} 人)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <p className="text-xs text-gray-400 mb-3">仅更新下方选择了的字段, 未选择的字段保持不变</p>
        <div className="space-y-3">
          <div><label className="block text-xs text-gray-500 mb-1">身份 (不变)</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">不变</option><option value="STUDENT">学生</option><option value="TEACHER">教师</option><option value="USER">用户</option><option value="ADMIN">管理员</option></select></div>
          <div><label className="block text-xs text-gray-500 mb-1">状态 (不变)</label><select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">不变</option><option value="NORMAL">正常</option><option value="GRADUATED">毕业生</option><option value="BANNED">封禁</option></select></div>
          <div><label className="block text-xs text-gray-500 mb-1">年级 (留空=不变)</label><input value={grade} onChange={e => setGrade(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="留空=不变" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">班级 (留空=不变)</label><input value={className} onChange={e => setClassName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="留空=不变" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">认证状态 (不变)</label><select value={verified} onChange={e => setVerified(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">不变</option><option value="true">已认证</option><option value="false">未认证</option></select></div>
          <div><label className="block text-xs text-gray-500 mb-1">备注 (留空=不变)</label><input value={remark} onChange={e => setRemark(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="留空=不变" /></div>
        </div>
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        {result && <p className="mt-3 text-sm text-green-600">{result}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">{saving ? '更新中…' : '批量更新'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Excel 导入弹窗 ----------
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    if (!file) { setErr('请先选择 Excel 文件'); return; }
    setSaving(true); setErr(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res: any = await api.post('/api/admin/users/import', fd);
      setResult(res);
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('cw_token');
      const res = await fetch(`${api.base}/api/admin/users/template`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user导入模板.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Excel 导入用户</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 mb-3">
          <p className="text-xs text-blue-700">填写说明: 昵称必填, 密码留空默认 123456, 身份可选 学生/教师/管理员/用户, 状态可选 正常/毕业生/封禁</p>
        </div>
        <label className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-gray-300 py-8 mb-3 cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition">
          <svg className="h-10 w-10 text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 8l-5-5-5 5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-sm text-green-600 font-medium">{file ? file.name : '点击选择 Excel 文件'}</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }} />
        </label>
        {err && <p className="mb-3 text-sm text-red-500">{err}</p>}
        {result && (
          <div className="mb-3 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-900">{result.message}</p>
            {result.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">查看错误明细 ({result.errors.length})</summary>
                <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-400">{e}</p>)}
                </div>
              </details>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">关闭</button>
          <button onClick={submit} disabled={saving || !file} className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{saving ? '导入中…' : '开始导入'}</button>
        </div>
        <button onClick={downloadTemplate} className="mt-3 w-full text-center text-xs text-blue-500 hover:text-blue-600 hover:underline">点击下载导入模板</button>
      </div>
    </div>
  );
}

// ---------- 通知发布 + 历史记录 (管理员) ----------
interface NotifItem {
  id: string;
  title: string;
  content: string;
  type: string;
  pinned: boolean;
  createdAt: string;
}

function NotificationSender() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('ALL');
  const [role, setRole] = useState('STUDENT');
  const [sendEmail, setSendEmail] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [type, setType] = useState('ANNOUNCE');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  // 历史记录
  const [history, setHistory] = useState<NotifItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editing, setEditing] = useState<NotifItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPinned, setEditPinned] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const TYPE_OPTIONS = [
    { value: 'ANNOUNCE', label: '📢 公告' },
    { value: 'SYSTEM', label: '⚙️ 系统通知' },
    { value: 'POST', label: '📝 帖子通知' },
  ];

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<{ items: NotifItem[] }>('/api/admin/notifications');
      setHistory(res.items);
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    if (!title.trim() || !content.trim()) { setMsg('请填写标题和内容'); return; }
    setSending(true); setMsg('');
    try {
      const body: any = { title, content, target, type, sendEmail, pinned };
      if (target === 'ROLE') body.role = role;
      await api.post('/api/admin/notifications', body);
      setMsg('通知发送成功！');
      setTitle(''); setContent(''); setPinned(false);
      loadHistory();
    } catch (e: any) { setMsg(e.message); } finally { setSending(false); }
  };

  const startEdit = (n: NotifItem) => {
    setEditing(n); setEditTitle(n.title); setEditContent(n.content); setEditPinned(n.pinned);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editTitle.trim() || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      await api.patch(`/api/admin/notifications/${editing.id}`, { title: editTitle, content: editContent, pinned: editPinned });
      setEditing(null);
      loadHistory();
    } catch (e: any) { alert(e.message); } finally { setSavingEdit(false); }
  };

  const del = async (n: NotifItem) => {
    if (!confirm(`确定删除通知「${n.title}」吗？`)) return;
    try {
      await api.del(`/api/admin/notifications/${n.id}`);
      loadHistory();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      {/* 发布通知 */}
      <div>
        <SectionTitle title="发布通知" desc="向用户推送站内通知，可选同时发送邮件" />
        {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}
        <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
          {/* 通知类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">通知类型</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setType(o.value)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${type === o.value ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">标题</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40" placeholder="通知标题" />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">内容</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40" placeholder="通知正文" />
          </div>

          {/* 发送对象 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">发送对象</label>
            <div className="flex gap-3">
              <button
                onClick={() => setTarget('ALL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${target === 'ALL' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
              >
                全体用户
              </button>
              <button
                onClick={() => setTarget('ROLE')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${target === 'ROLE' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
              >
                按角色
              </button>
            </div>
            {target === 'ROLE' && (
              <select value={role} onChange={e => setRole(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="STUDENT">学生</option>
                <option value="TEACHER">教师</option>
                <option value="ADMIN">管理员</option>
              </select>
            )}
          </div>

          {/* 选项 */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
              <span>⭐ 强调通知（置顶显示）</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
              <span>📧 同时发送邮件（需配置 SMTP）</span>
            </label>
          </div>

          <button onClick={send} disabled={sending} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition">
            {sending ? '发送中…' : '发送通知'}
          </button>
        </div>
      </div>

      {/* 历史记录 */}
      <div>
        <SectionTitle title="通知历史记录" desc="查看、编辑或删除已发送的通知" />
        {loadingHistory ? (
          <p className="py-6 text-center text-gray-400 text-sm">加载中…</p>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-gray-400 text-sm">暂无通知记录</p>
        ) : (
          <div className="space-y-2">
            {history.map(n => (
              <div key={n.id} className={`rounded-xl border bg-white p-4 ${n.pinned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.pinned && <span className="text-amber-500 text-xs">📌</span>}
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {TYPE_OPTIONS.find(o => o.value === n.type)?.label || n.type}
                      </span>
                      <span className="font-semibold text-sm text-gray-900 truncate">{n.title}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">{n.content}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => startEdit(n)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200">编辑</button>
                    <button onClick={() => del(n)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">编辑通知</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editPinned} onChange={e => setEditPinned(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                ⭐ 强调通知（置顶显示）
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
              <button onClick={saveEdit} disabled={savingEdit} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {savingEdit ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 站点设置 (管理员) ----------
// ---------- 邮件配置 (独立页面) ----------
function EmailSettings() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState('');
  const [connectDetail, setConnectDetail] = useState<{ alternatives?: { label: string; ok: boolean; hint: string }[]; suggestion?: string } | null>(null);

  // 模板相关
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplHtml, setTplHtml] = useState('');
  const [tplVariables, setTplVariables] = useState<{ name: string; desc: string }[]>([]);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplMsg, setTplMsg] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>('/api/admin/site-config').then(data => {
      // 确保关键开关有默认值, 避免 "显示了但未保存" 的问题
      const withDefaults: Record<string, string> = {
        smtp_enabled: data.smtp_enabled ?? 'true',
        smtp_secure: data.smtp_secure ?? 'true',
        ...data,
      };
      setCfg(withDefaults);
    }).catch(console.error).finally(() => setLoading(false));
    api.get<{ templates: any[] }>('/api/admin/email-templates').then(r => {
      setTemplates(r.templates || []);
      if (r.templates?.length) {
        const first = r.templates[0];
        setSelectedKey(first.key);
        setTplName(first.name);
        setTplSubject(first.subject);
        setTplHtml(first.html);
        setTplVariables(first.variables || []);
      }
    }).catch(console.error);
  }, []);

  const set = (k: string, v: string) => setCfg({ ...cfg, [k]: v });
  const enabled = cfg.smtp_enabled === undefined ? true : cfg.smtp_enabled === 'true';

  const save = async () => {
    setSaving(true); setMsg('');
    try { await api.patch('/api/admin/site-config', cfg); setMsg('保存成功'); }
    catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setConnecting(true); setConnectMsg(''); setConnectDetail(null);
    try {
      const r = await api.post<{ message?: string }>('/api/admin/site-config/test-connection', {});
      setConnectMsg(r.message || '连接成功');
    } catch (e: any) {
      setConnectMsg(e.message);
      // 后端返回的多策略诊断
      if (e?.data) {
        setConnectDetail({ alternatives: e.data.alternatives, suggestion: e.data.suggestion });
      }
    } finally { setConnecting(false); }
  };

  const sendTest = async () => {
    if (!testEmail) { setTestMsg('请输入收件邮箱'); return; }
    setTesting(true); setTestMsg('');
    try {
      const r = await api.post<{ message?: string }>('/api/admin/site-config/test-email', { to: testEmail });
      setTestMsg(r.message || '已发送');
    } catch (e: any) { setTestMsg(e.message); } finally { setTesting(false); }
  };

  // 选择模板
  const selectTemplate = (t: any) => {
    setSelectedKey(t.key);
    setTplName(t.name);
    setTplSubject(t.subject);
    setTplHtml(t.html);
    setTplVariables(t.variables || []);
    setTplMsg('');
  };

  // 保存模板
  const saveTemplate = async () => {
    if (!selectedKey) return;
    setTplSaving(true); setTplMsg('');
    try {
      await api.post('/api/admin/email-templates', { key: selectedKey, name: tplName, subject: tplSubject, html: tplHtml });
      setTplMsg('模板已保存');
      setTemplates(prev => prev.map(t => t.key === selectedKey ? { ...t, name: tplName, subject: tplSubject, html: tplHtml, isOverridden: true } : t));
    } catch (e: any) { setTplMsg(e.message); } finally { setTplSaving(false); }
  };

  if (loading) return <p className="py-6 text-center text-gray-400">加载中…</p>;

  return (
    <div>
      <SectionTitle title="邮件配置" desc="配置 SMTP 邮件服务、连接测试与邮件模板，用于密码重置、通知推送等" />
      {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      <div className="space-y-5">
        {/* 服务配置 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>🔌</span> 服务配置
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={e => set('smtp_enabled', String(e.target.checked))} className="h-5 w-5" />
              <span className="text-sm text-gray-600">{enabled ? '已启用' : '已停用'}</span>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP 服务器</label>
              <input value={cfg.smtp_host || ''} onChange={e => set('smtp_host', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="smtp.163.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">端口</label>
                <input value={cfg.smtp_port || ''} onChange={e => set('smtp_port', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="465" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">加密方式</label>
                <select value={cfg.smtp_secure || 'true'} onChange={e => set('smtp_secure', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="true">SSL/TLS</option>
                  <option value="false">不加密 (STARTTLS/587)</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cfg.smtp_tls_reject_unauthorized === 'false'} onChange={e => set('smtp_tls_reject_unauthorized', String(!e.target.checked))} className="h-4 w-4" />
              <span className="text-xs text-gray-500">跳过 TLS 证书校验 (仅在证书异常时临时启用, 有安全风险)</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发件人账号</label>
              <input value={cfg.smtp_user || ''} onChange={e => set('smtp_user', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="your-email@163.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">授权码 / 密码</label>
              <input type="password" value={cfg.smtp_pass || ''} onChange={e => set('smtp_pass', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="••••••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发件人邮箱 (FROM EMAIL)</label>
              <input value={cfg.smtp_from_email || ''} onChange={e => set('smtp_from_email', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="通常与发件人账号一致" />
              <p className="text-xs text-gray-400 mt-1">通常与发件人账号一致，部分服务商强制要求一致。</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发件人姓名</label>
              <input value={cfg.smtp_from_name || ''} onChange={e => set('smtp_from_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="校园墙" />
            </div>
          </div>
        </div>

        {/* 服务测试 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📤</span> 服务测试
          </h3>
          <div className="space-y-3">
            {/* 连接测试 */}
            <div className="flex gap-2">
              <button onClick={testConnection} disabled={connecting || !enabled} className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-600">{connecting ? '测试中…' : '测试连接'}</button>
              <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="输入收件邮箱发送测试" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button onClick={sendTest} disabled={testing || !enabled} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-700">{testing ? '发送中…' : '发送测试'}</button>
            </div>
            {connectMsg && <p className={`text-xs ${connectMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>连接: {connectMsg}</p>}
            {connectDetail && (
              <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs">
                {connectDetail.alternatives && connectDetail.alternatives.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">🔍 自动尝试的备选组合:</p>
                    {connectDetail.alternatives.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className={a.ok ? 'text-green-600' : 'text-gray-400'}>{a.ok ? '✅' : '❌'}</span>
                        <span className="text-gray-600"><b>{a.label}</b>: {a.hint}</span>
                      </div>
                    ))}
                  </div>
                )}
                {connectDetail.suggestion && (
                  <p className="mt-2 text-amber-700 bg-amber-50 rounded px-2 py-1.5">💡 {connectDetail.suggestion}</p>
                )}
              </div>
            )}
            {testMsg && <p className={`text-xs ${testMsg.includes('成功') || testMsg.includes('已') ? 'text-green-600' : 'text-red-500'}`}>邮件: {testMsg}</p>}
          </div>
        </div>

        {/* 邮件模板 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📝</span> 邮件模板
          </h3>
          <div className="text-xs text-gray-400 mb-3">
            支持变量:
            {tplVariables.length > 0 ? (
              <span className="ml-1">
                {tplVariables.map(v => (
                  <code key={v.name} className="bg-gray-100 px-1.5 py-0.5 rounded mr-1.5" title={v.desc}>{`{{${v.name}}}`}</code>
                ))}
              </span>
            ) : (
              <span className="ml-1 text-gray-300">（当前模板未声明变量）</span>
            )}
            <span className="ml-1 text-gray-400">· 语法: <code className="bg-gray-100 px-1 rounded">{'{{var}}'}</code> 自动转义, <code className="bg-gray-100 px-1 rounded">{'{{!var}}'}</code> 不转义, <code className="bg-gray-100 px-1 rounded">{'{{#if var}}…{{/if}}'}</code> 条件块</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 模板列表 */}
            <div className="md:col-span-1 space-y-1">
              {templates.map(t => (
                <button
                  key={t.key}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm ${selectedKey === t.key ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    {t.isOverridden && <span className="text-[10px] text-green-600">已自定义</span>}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">{t.key}</div>
                </button>
              ))}
            </div>

            {/* 模板编辑器 */}
            <div className="md:col-span-3 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模板名称</label>
                <input value={tplName} onChange={e => setTplName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮件主题</label>
                <input value={tplSubject} onChange={e => setTplSubject(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="支持变量" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮件内容 (HTML)</label>
                <textarea value={tplHtml} onChange={e => setTplHtml(e.target.value)} rows={12} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-xs" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveTemplate} disabled={tplSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700">{tplSaving ? '保存中…' : '保存模板'}</button>
                {tplMsg && <span className={`self-center text-xs ${tplMsg.includes('已') ? 'text-green-600' : 'text-red-500'}`}>{tplMsg}</span>}
              </div>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700">
          {saving ? '保存中…' : '保存配置'}
        </button>
      </div>
    </div>
  );
}

function SiteSettings() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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

  if (loading) return <p className="py-6 text-center text-gray-400">加载中…</p>;

  return (
    <div>
      <SectionTitle title="站点设置" desc="站点信息、功能开关与内容配置" />
      {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      <div className="space-y-5">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">首页滚动公告</label>
              <input value={cfg.announcement_text || ''} onChange={e => set('announcement_text', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="欢迎来到校园墙！请文明发言..." />
              <p className="text-xs text-gray-400 mt-1">显示在首页顶部的滚动公告栏</p>
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
  const [about, setAbout] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>('/api/admin/site-config')
      .then(d => {
        setAgreement(d.agreement_content || '');
        setPrivacy(d.privacy_content || '');
        setAbout(d.about_content || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.patch('/api/admin/site-config', { agreement_content: agreement, privacy_content: privacy, about_content: about });
      setMsg('保存成功');
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  if (loading) return <p className="py-6 text-center text-gray-400">加载中…</p>;

  return (
    <div>
      <SectionTitle title="协议管理" desc="编辑关于我们、用户协议与隐私政策内容，支持纯文本格式" />
      {msg && <div className={`mb-3 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      <div className="space-y-5">
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">ℹ️ 关于我们</h3>
            <span className="text-xs text-gray-400">{about.length} 字</span>
          </div>
          <textarea
            value={about}
            onChange={e => setAbout(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed"
            placeholder="请输入关于我们页面的内容..."
          />
          <p className="text-xs text-gray-400 mt-1">将显示在「关于校园墙」页面，支持换行</p>
        </div>

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
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}

// ---------- 实名认证审核 ----------
const REJECT_REASONS = [
  '照片不清晰',
  '非校园卡/学生证',
  '信息无法辨认',
  '照片与本人不符',
  '照片已过期',
];

const FIELD_COLORS = [
  'border-green-400 bg-green-400/10',
  'border-blue-400 bg-blue-400/10',
  'border-purple-400 bg-purple-400/10',
  'border-orange-400 bg-orange-400/10',
  'border-pink-400 bg-pink-400/10',
  'border-cyan-400 bg-cyan-400/10',
  'border-lime-400 bg-lime-400/10',
];
const fieldColor = (i: number) => FIELD_COLORS[i % FIELD_COLORS.length];

// 模板字段名 -> 用户资料字段 的映射 (管理员可任意命名字段, 此处尽量匹配常见命名)
function mapFieldsToUser(fields: Record<string, string>) {
  const out: any = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = k.toLowerCase().replace(/\s+/g, '');
    const val = v.trim();
    if (!val) continue;
    if (['name', '姓名', '名字'].includes(key)) out.realName = val;
    else if (['studentid', '学号', '编号'].includes(key)) out.studentId = val;
    else if (['grade', '年级'].includes(key)) out.grade = val;
    else if (['classname', 'class', '班级'].includes(key)) out.className = val;
    else if (['school', '学校', '院校'].includes(key)) out.school = val;
  }
  return out;
}

function VerificationReviewTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'PENDING' | 'AI_REVIEWING' | 'ALL' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [busy, setBusy] = useState(false);
  // 复审弹窗
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const load = useCallback(() => {
    setLoading(true); setErr('');
    api.get<{ items: any[] }>(`/api/admin/verifications?status=${filter}`)
      .then(d => setItems(d.items))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openReview = (u: any) => {
    const ai = u.verificationAiResult || {};
    const aiFields: Record<string, string> = ai.fields || {};
    // 字段集合: AI 识别出的字段 + 兜底常用字段
    const baseFields: Record<string, string> = {
      姓名: aiFields['姓名'] ?? aiFields['name'] ?? u.realName ?? '',
      学号: aiFields['学号'] ?? aiFields['studentId'] ?? u.studentId ?? '',
      学校: aiFields['学校'] ?? aiFields['school'] ?? '',
      年级: aiFields['年级'] ?? aiFields['grade'] ?? u.grade ?? '',
      班级: aiFields['班级'] ?? aiFields['className'] ?? u.className ?? '',
    };
    // 合并 AI 识别出的所有字段 (含自定义命名), 但去重已知字段
    const merged: Record<string, string> = { ...baseFields };
    for (const [k, v] of Object.entries(aiFields)) {
      const norm = k.toLowerCase().replace(/\s+/g, '');
      if (['name', '姓名', '名字'].includes(norm)) continue;
      if (['studentid', '学号', '编号'].includes(norm)) continue;
      if (['grade', '年级'].includes(norm)) continue;
      if (['classname', 'class', '班级'].includes(norm)) continue;
      if (['school', '学校', '院校'].includes(norm)) continue;
      merged[k] = v;
    }
    setFields(merged);
    setRejectMode(false);
    setRejectReason('');
    setCustomReason('');
    setReviewTarget(u);
  };

  const doApprove = async () => {
    if (!reviewTarget) return;
    if (!confirm('确认通过该用户的实名认证? 将同步更新其姓名/学号等信息。')) return;
    setBusy(true);
    try {
      const mapped = mapFieldsToUser(fields);
      await api.patch(`/api/admin/users/${reviewTarget.id}`, {
        verificationStatus: 'APPROVED',
        realName: mapped.realName || undefined,
        studentId: mapped.studentId || undefined,
        grade: mapped.grade || undefined,
        className: mapped.className || undefined,
      });
      setReviewTarget(null);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const doReject = async () => {
    if (!reviewTarget) return;
    const reason = rejectReason || customReason.trim();
    if (!reason) { alert('请选择或填写驳回原因'); return; }
    setBusy(true);
    try {
      await api.patch(`/api/admin/users/${reviewTarget.id}`, {
        verificationStatus: 'REJECTED',
        verificationRejectReason: reason,
      });
      setReviewTarget(null);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING: 'bg-amber-100 text-amber-700',
      AI_REVIEWING: 'bg-sky-100 text-sky-700',
      REJECTED: 'bg-red-100 text-red-700',
    };
    const label: Record<string, string> = { APPROVED: '已通过', PENDING: '待人工复审', AI_REVIEWING: 'AI 初审中', REJECTED: '已驳回' };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-600'}`}>{label[s] || s}</span>;
  };

  const ai = reviewTarget?.verificationAiResult || {};
  const bboxes = ai.bboxes || {};

  return (
    <div>
      <SectionTitle title="实名认证审核" desc="AI 初审通过后进入人工复审。点击「复审」查看大图与 AI 框选信息, 核对后通过或驳回。" />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['PENDING', 'AI_REVIEWING', 'ALL', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === f ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {f === 'PENDING' ? '待人工复审' : f === 'AI_REVIEWING' ? 'AI 初审中' : f === 'ALL' ? '全部' : f === 'APPROVED' ? '已通过' : '已驳回'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">加载中…</div>
      ) : err ? (
        <div className="py-8 text-center text-red-500">{err}</div>
      ) : items.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
          <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm">暂无认证申请</span>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(u => {
            const isReviewable = u.verificationStatus === 'PENDING';
            return (
              <div key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {u.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : (u.nickname || 'U')[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{u.nickname} <span className="text-gray-400 font-normal">· {u.role}</span></div>
                      <div className="text-xs text-gray-400">{u.realName || '未填写真名'} {u.studentId ? `· 学号 ${u.studentId}` : ''} {u.grade ? `· ${u.grade}${u.className || ''}` : ''}</div>
                    </div>
                  </div>
                  {statusBadge(u.verificationStatus)}
                </div>

                {u.verificationStatus === 'REJECTED' && u.verificationRejectReason && (
                  <div className="mt-2 text-xs text-red-500">驳回原因: {u.verificationRejectReason}</div>
                )}

                {isReviewable && (
                  <button
                    onClick={() => openReview(u)}
                    className="mt-3 w-full rounded-lg bg-blue-50 py-2 text-sm text-blue-600 hover:bg-blue-100"
                  >
                    进入人工复审
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 人工复审浮窗 */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && setReviewTarget(null)}>
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">人工复审 · {reviewTarget.nickname}</h3>
              <button onClick={() => !busy && setReviewTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* 上方: 大图 + AI 框选 */}
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">认证照片 (AI 已框选关键信息)</span>
                {ai.confidence && (
                  <span className="text-xs text-gray-400">AI 置信度: {ai.confidence === 'high' ? '高' : ai.confidence === 'medium' ? '中' : '低'}</span>
                )}
              </div>
              <div className="relative inline-block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reviewTarget.verificationPhoto} alt="认证材料" className="w-full rounded-lg" />
                {/* AI 边界框 */}
                {Object.entries(bboxes).map(([key, box]: [string, any], idx: number) => {
                  if (!box) return null;
                  return (
                    <div
                      key={key}
                      className={`absolute border-2 rounded ${fieldColor(idx)}`}
                      style={{
                        left: `${box.x * 100}%`,
                        top: `${box.y * 100}%`,
                        width: `${box.w * 100}%`,
                        height: `${box.h * 100}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-0 text-[10px] font-medium text-gray-700 bg-white/80 px-1 rounded whitespace-nowrap">{key}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 下方: 可编辑信息 */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-gray-500">核对并修正以下信息 (字段来自识别模板, 通过后将同步到用户资料)</div>
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(fields).map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{key}</label>
                    <input
                      value={fields[key] || ''}
                      onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder={`请输入${key}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 驳回原因选择 */}
            {rejectMode && (
              <div className="mt-4 rounded-xl bg-red-50 p-3">
                <div className="mb-2 text-xs font-medium text-red-700">选择驳回原因</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {REJECT_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setRejectReason(r); setCustomReason(''); }}
                      className={`rounded-full px-3 py-1 text-xs ${rejectReason === r ? 'bg-red-500 text-white' : 'bg-white text-red-600 border border-red-200'}`}
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    onClick={() => { setRejectReason(''); }}
                    className={`rounded-full px-3 py-1 text-xs ${!rejectReason && customReason ? 'bg-red-500 text-white' : 'bg-white text-red-600 border border-red-200'}`}
                  >
                    自定义
                  </button>
                </div>
                <input
                  value={customReason}
                  onChange={e => { setCustomReason(e.target.value); setRejectReason(''); }}
                  className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
                  placeholder="输入自定义驳回原因…"
                />
              </div>
            )}

            {/* 底部操作 */}
            <div className="mt-5 flex gap-2">
              {!rejectMode ? (
                <>
                  <button
                    onClick={doApprove}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-green-500 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
                  >
                    {busy ? '处理中…' : '通过认证'}
                  </button>
                  <button
                    onClick={() => setRejectMode(true)}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    驳回
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={doReject}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {busy ? '处理中…' : '确认驳回'}
                  </button>
                  <button
                    onClick={() => setRejectMode(false)}
                    disabled={busy}
                    className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-600"
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 封禁申诉审核 ----------
function BanAppealsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErr('');
    api.get<{ items: any[] }>(`/api/admin/ban-appeals?status=${filter}`)
      .then(d => setItems(d.items))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setBusy(true);
    try {
      await api.patch('/api/admin/ban-appeals', { id, action, reviewerNote: reviewNote.trim() });
      setReviewing(null); setReviewNote('');
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
    };
    const label: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-600'}`}>{label[s] || s}</span>;
  };

  return (
    <div>
      <SectionTitle title="封禁申诉审核" desc="审核用户提交的封禁申诉, 通过则自动解封" />
      {/* 筛选 */}
      <div className="mb-4 flex gap-2">
        {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === f ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {f === 'PENDING' ? '待审核' : f === 'ALL' ? '全部' : f === 'APPROVED' ? '已通过' : '已驳回'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">加载中…</div>
      ) : err ? (
        <div className="py-8 text-center text-red-500">{err}</div>
      ) : items.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
          <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm">暂无申诉记录</span>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {a.user?.avatar ? <img src={a.user.avatar} alt="" className="h-full w-full object-cover" /> : (a.user?.nickname || 'U')[0]}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{a.user?.nickname || '匿名'}</span>
                  {statusBadge(a.status)}
                </div>
                <span className="text-xs text-gray-400">{fmtDate(a.createdAt)}</span>
              </div>

              <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <div><span className="text-gray-400">申诉原因: </span>{a.reason}</div>
                <div className="mt-1"><span className="text-gray-400">申诉内容: </span>{a.content}</div>
                {a.images?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.images.map((src: string, i: number) => (
                      <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </div>

              {/* 原封禁信息 */}
              {a.banRecord && (
                <div className="mt-2 text-xs text-gray-400">
                  原封禁: {a.banRecord.reason || '未填写原因'} · {a.banRecord.isPermanent ? '永久封禁' : `${a.banRecord.durationDays} 天`}
                </div>
              )}

              {a.reviewedAt && (
                <div className="mt-2 text-xs text-gray-400">
                  审核于 {fmtDate(a.reviewedAt)}{a.reviewerNote ? ` · 备注: ${a.reviewerNote}` : ''}
                </div>
              )}

              {/* 审核操作 */}
              {a.status === 'PENDING' && (
                reviewing === a.id ? (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <textarea
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      placeholder="审核备注 (可选, 将通知用户)"
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => review(a.id, 'APPROVE')}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-green-500 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-50"
                      >
                        {busy ? '处理中…' : '通过 (自动解封)'}
                      </button>
                      <button
                        onClick={() => review(a.id, 'REJECT')}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-red-500 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {busy ? '处理中…' : '驳回'}
                      </button>
                      <button
                        onClick={() => { setReviewing(null); setReviewNote(''); }}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReviewing(a.id)}
                    className="mt-3 w-full rounded-lg bg-blue-50 py-2 text-sm text-blue-600 hover:bg-blue-100"
                  >
                    审核
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 角色与权限管理 (超级管理员) ----------
interface RoleItem {
  id: string; code: string; name: string;
  permissions: string[]; isSystem: boolean; isDefault: boolean;
  userCount: number; createdAt: string;
}

function RolesManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ roles: RoleItem[] }>('/api/admin/roles');
      setRoles(data.roles);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 清除已不存在的选中项
  useEffect(() => {
    setSelected(prev => {
      const validIds = new Set(roles.map(r => r.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach(id => { if (validIds.has(id)) next.add(id); else changed = true; });
      return changed ? next : prev;
    });
  }, [roles]);

  const customRoles = roles.filter(r => !r.isSystem);
  const allCustomSelected = customRoles.length > 0 && customRoles.every(r => selected.has(r.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allCustomSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(customRoles.map(r => r.id)));
    }
  };

  const handleDelete = async (r: RoleItem) => {
    if (!confirm(`确认删除角色「${r.name}」? 关联用户将重置为系统角色。`)) return;
    try {
      await api.del(`/api/admin/roles/${r.id}`);
      setMsg('删除成功'); load();
    } catch (e: any) { setMsg(e.message); }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selected).filter(id => {
      const r = roles.find(x => x.id === id);
      return r && !r.isSystem;
    });
    if (ids.length === 0) { setMsg('请先选择要删除的自定义角色'); return; }
    if (!confirm(`确认删除选中的 ${ids.length} 个角色? 关联用户将重置为系统角色。`)) return;
    try {
      const res: any = await api.post('/api/admin/roles/batch-delete', { ids });
      setMsg(res?.message || '批量删除成功');
      setSelected(new Set());
      load();
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle title="角色与权限管理" desc="自定义角色名称, 为每个角色开启/关闭功能权限。系统内置角色不可删除。" />
        <button onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ 新建角色</button>
      </div>
      {msg && <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{msg}</div>}
      {loading ? <div className="text-gray-400">加载中…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 px-2 w-10">
                  <input
                    type="checkbox"
                    checked={allCustomSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                    title="全选自定义角色"
                  />
                </th>
                <th className="py-2 px-2">角色名称</th>
                <th className="py-2 px-2">类型</th>
                <th className="py-2 px-2">用户数</th>
                <th className="py-2 px-2">权限数</th>
                <th className="py-2 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">
                    {r.isSystem ? (
                      <span className="text-gray-300" title="系统角色不可删除">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="rounded border-gray-300"
                      />
                    )}
                  </td>
                  <td className="py-2 px-2 font-medium">{r.name}</td>
                  <td className="py-2 px-2">
                    {r.isSystem
                      ? <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">系统</span>
                      : <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">自定义</span>}
                    {r.isDefault && <span className="ml-1 rounded bg-green-50 px-2 py-0.5 text-xs text-green-600">默认</span>}
                  </td>
                  <td className="py-2 px-2">{r.userCount}</td>
                  <td className="py-2 px-2">{r.permissions.length}</td>
                  <td className="py-2 px-2 space-x-2">
                    <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline">编辑</button>
                    {!r.isSystem && <button onClick={() => handleDelete(r)} className="text-red-500 hover:underline">删除</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">
          <span className="text-amber-700">已选 {selected.size} 项</span>
          <button onClick={handleBatchDelete} className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600">
            批量删除
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline text-xs">取消选择</button>
        </div>
      )}
      {(editing || creating) && (
        <RoleEditModal
          role={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { load(); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function RoleEditModal({ role, onClose, onSaved }: { role: RoleItem | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name || '');
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions || []));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (code: string) => {
    const ns = new Set(perms);
    if (ns.has(code)) ns.delete(code); else ns.add(code);
    setPerms(ns);
  };

  const save = async () => {
    if (!name.trim()) { setErr('请输入角色名称'); return; }
    setSaving(true); setErr('');
    try {
      const body = { name: name.trim(), permissions: Array.from(perms) };
      if (role) {
        await api.patch(`/api/admin/roles/${role.id}`, body);
      } else {
        await api.post('/api/admin/roles', body);
      }
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  // 全选 / 全不选
  const allCodes = PERMISSIONS.map(p => p.code);
  const allChecked = allCodes.every(c => perms.has(c));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{role ? '编辑角色' : '新建角色'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">角色名称</label>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={20}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="如: 内容审核员" />

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">功能权限开关</span>
          <button onClick={() => setPerms(allChecked ? new Set() : new Set(allCodes))}
            className="text-xs text-blue-600 hover:underline">{allChecked ? '全部取消' : '全部开启'}</button>
        </div>

        <div className="space-y-4">
          {Object.entries(PERMISSIONS_BY_GROUP).map(([group, items]) => (
            <div key={group}>
              <h4 className="mb-2 text-sm font-semibold text-gray-800">{group}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map(p => {
                  const locked = SUPER_ADMIN_ONLY_PERMISSIONS.has(p.code);
                  const checked = perms.has(p.code);
                  return (
                    <label key={p.code} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200'} ${locked ? 'opacity-60' : ''}`}>
                      <input type="checkbox" checked={checked} disabled={locked}
                        onChange={() => toggle(p.code)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      <span className="flex-1">{p.name}</span>
                      {locked && <span className="text-xs text-amber-600">仅超管</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">取消</button>
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 管理后台主组件 ----------
export function AdminPanel({ tab, isSuper }: { tab: AdminTab; isSuper: boolean }) {
  switch (tab) {
    case 'overview': return <OverviewTab />;
    case 'posts': return <PostsTab />;
    case 'moderation': return <ModerationTab />;
    case 'comments': return <CommentsTab />;
    case 'users': return <UsersTab isSuper={isSuper} />;
    case 'verification': return <VerificationReviewTab />;
    case 'template': return <TemplateManager />;
    case 'appeals': return <BanAppealsTab />;
    case 'notifications': return <NotificationSender />;
    case 'settings': return <SiteSettings />;
    case 'email': return <EmailSettings />;
    case 'agreement': return <AgreementManager />;
    case 'roles': return <RolesManager />;
    default: return <OverviewTab />;
  }
}
