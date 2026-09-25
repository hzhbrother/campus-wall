'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export type AdminTab = 'overview' | 'posts' | 'moderation' | 'comments' | 'users' | 'appeals' | 'notifications' | 'settings' | 'agreement';

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
const REJECT_VIOLATION_TYPES = [
  { value: 'SPAM', label: '垃圾广告', points: 10 },
  { value: 'ABUSE', label: '辱骂攻击', points: 20 },
  { value: 'PORN', label: '色情低俗', points: 30 },
  { value: 'ILLEGAL', label: '违法违规', points: 50 },
  { value: 'PLAGIARISM', label: '抄袭侵权', points: 15 },
  { value: 'OTHER', label: '其他违规', points: 10 },
];

function ModerationTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [violationType, setViolationType] = useState('OTHER');
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
    try { await api.post(`/api/admin/posts/${id}/reject`, { reason, violationType }); setRejectId(null); setReason(''); setViolationType('OTHER'); load(); } catch (e: any) { setErr(e.message); }
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
            <select value={role} onChange={e => setRole(e.target.value)} disabled={!isSuper && user.role === 'SUPER_ADMIN'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
              <option value="STUDENT">学生</option>
              <option value="TEACHER">教师</option>
              <option value="ADMIN">管理员</option>
              {isSuper && <option value="SUPER_ADMIN">超级管理员</option>}
            </select>
          </div>

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
  { days: -1, label: '自定义', color: 'bg-violet-500 hover:bg-violet-600 text-white' },
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
  // 自定义时长
  const [customDays, setCustomDays] = useState(0);
  const [customHours, setCustomHours] = useState(0);
  // 自定义扣分
  const [useCustomPoints, setUseCustomPoints] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);

  const selectedOpt = BAN_OPTIONS.find(o => o.days === selected);
  const selectedVType = VIOLATION_TYPES.find(v => v.value === violationType);

  // 最终生效的封禁天数/小时/扣分
  const isCustom = selected === -1;
  const isPermanent = selected === 0;
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

  const doBan = async () => {
    if (selected === null) return;
    if (isCustom && finalDays <= 0 && finalHours <= 0) {
      setErr('自定义时长至少需要 1 小时');
      return;
    }
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
    setConfirm(true);
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
              <label className="mb-1.5 block text-sm text-gray-600">违规类型</label>
              <div className="grid grid-cols-3 gap-2">
                {VIOLATION_TYPES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => { setViolationType(v.value); setUseCustomPoints(false); }}
                    className={`rounded-lg border px-2 py-2 text-xs transition ${violationType === v.value && !useCustomPoints ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}
                  >
                    <div className="font-medium">{v.label}</div>
                    <div className="mt-0.5 text-[10px] text-red-500">扣 {v.points} 分</div>
                  </button>
                ))}
              </div>
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

            {/* 封禁原因 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-gray-600">封禁原因 (可选)</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="例如: 恶意刷屏、发布违规内容..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>

            {/* 封禁时长 */}
            <div className="mb-4">
              <label className="mb-2 block text-sm text-gray-600">选择封禁时长</label>
              <div className="grid grid-cols-3 gap-2">
                {BAN_OPTIONS.map(o => (
                  <button key={o.days} onClick={() => handleSelect(o.days)} className={`rounded-lg px-3 py-3 text-sm font-medium transition ${o.color}`}>{o.label}</button>
                ))}
              </div>
              {/* 自定义时长输入 */}
              {isCustom && (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <div className="flex items-center gap-3">
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
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">天可填 0, 小时 0-23, 总时长需大于 0</p>
                </div>
              )}
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
            <div className="flex gap-2 pt-1">
              <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="输入收件邮箱测试" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button onClick={sendTest} disabled={testing} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{testing ? '发送中…' : '发送测试'}</button>
            </div>
            {testMsg && <p className={`text-xs ${testMsg.includes('成功') || testMsg.includes('已') ? 'text-green-600' : 'text-red-500'}`}>{testMsg}</p>}
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

// ---------- 管理后台主组件 ----------
export function AdminPanel({ tab, isSuper }: { tab: AdminTab; isSuper: boolean }) {
  switch (tab) {
    case 'overview': return <OverviewTab />;
    case 'posts': return <PostsTab />;
    case 'moderation': return <ModerationTab />;
    case 'comments': return <CommentsTab />;
    case 'users': return <UsersTab isSuper={isSuper} />;
    case 'appeals': return <BanAppealsTab />;
    case 'notifications': return <NotificationSender />;
    case 'settings': return <SiteSettings />;
    case 'agreement': return <AgreementManager />;
    default: return <OverviewTab />;
  }
}
