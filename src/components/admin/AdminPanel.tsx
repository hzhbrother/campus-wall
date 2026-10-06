'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PERMISSIONS, PERMISSIONS_BY_GROUP, SUPER_ADMIN_ONLY_PERMISSIONS } from '@/lib/permissions';
import { JUHE_TYPES } from '@/lib/aggregated-login';
import { BrandIcon } from '@/components/BrandIcons';
import { compressImage } from '@/lib/image-compress';
import TemplateManager from './TemplateManager';
import { BadgesManager } from './BadgesManager';

export type AdminTab = 'overview' | 'posts' | 'moderation' | 'comments' | 'users' | 'avatars' | 'verification' | 'qualifications' | 'template' | 'appeals' | 'notifications' | 'settings' | 'email' | 'agreement' | 'roles' | 'badges' | 'schools' | 'orgs' | 'quicklinks' | 'shop' | 'wishes';

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

// 图片真实性检测结果: 无异常不显示; 有异常显示"AI检测结果：原因"
function AiCheckBadge({ check }: { check: any }) {
  if (!check) return null;
  const { isAiGenerated, confidence, note } = check;
  // 无异常 → 完全不显示
  if (!isAiGenerated) return null;
  const color =
    confidence === 'high' ? 'bg-red-100 text-red-700'
      : confidence === 'medium' ? 'bg-orange-100 text-orange-700'
      : 'bg-amber-100 text-amber-700';
  // 格式: AI检测结果：[具体原因]
  return (
    <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      <span>AI检测结果：{note || '图片存疑, 请重点核对'}</span>
    </div>
  );
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
  const [schoolId, setSchoolId] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editUser, setEditUser] = useState<any>(null);
  const [banUser, setBanUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [pointsUser, setPointsUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageSize = 10;

  // 加载学校和团体列表用于筛选
  useEffect(() => {
    api.get<{ items: { id: string; name: string }[] }>('/api/schools').then(d => setSchools(d.items || [])).catch(() => {});
    api.get<{ items: { id: string; name: string }[] }>('/api/orgs').then(d => setOrganizations(d.items || [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true); setErr('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (role) params.set('role', role);
    if (schoolId) params.set('schoolId', schoolId);
    if (organizationId) params.set('organizationId', organizationId);
    if (q) params.set('q', q);
    api.get(`/api/admin/users?${params}`).then((d: any) => { setUsers(d.items); setTotal(d.total); })
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [page, role, schoolId, organizationId, q]);
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
        <select value={schoolId} onChange={e => { setSchoolId(e.target.value); if (e.target.value) setOrganizationId(''); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部学校</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={organizationId} onChange={e => { setOrganizationId(e.target.value); if (e.target.value) setSchoolId(''); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部团体</option>
          {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
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
                    {u.realName ? u.realName + ' · ' : ''}{u.email ? u.email + ' · ' : ''}帖子 {u._count?.posts}
                    <span className="ml-2 font-medium text-amber-600">积分 {u.points ?? 0}</span>
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
                <a href={`/users/${u.id}`} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">查看主页</a>
                <button onClick={() => setPointsUser(u)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-100">调整积分</button>
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
      {pointsUser && <PointsAdjustModal user={pointsUser} onClose={() => setPointsUser(null)} onDone={load} />}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onDone={load} isSuper={isSuper} />}
      {showBatch && <BatchUpdateModal selectedIds={selected} onClose={() => setShowBatch(false)} onDone={() => { load(); setSelected(new Set()); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={load} />}
    </div>
  );
}

// ---------- 编辑用户弹窗 ----------
const CLASS_LIST = ['1班', '2班', '3班', '4班', '5班', '6班', '7班', '8班', '9班', '10班'];

function EditUserModal({ user, onClose, onSaved, isSuper }: { user: any; onClose: () => void; onSaved: () => void; isSuper: boolean }) {
  const [realName, setRealName] = useState(user.realName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [remark, setRemark] = useState(user.remark || '');
  const [status, setStatus] = useState(user.status || 'NORMAL');
  // 角色选择值: 系统角色直接用枚举; 自定义角色用 "custom:<id>"
  const [roleVal, setRoleVal] = useState(user.roleId ? `custom:${user.roleId}` : (user.role || 'STUDENT'));
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string }[]>([]);
  const [verified, setVerified] = useState(!!user.verified);
  const [rejectReason, setRejectReason] = useState('');
  const [avatar, setAvatar] = useState(user.avatar || '');
  // 封面编辑
  const [coverImage, setCoverImage] = useState(user.coverImage || '');
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  // 头像审核驳回原因
  const [avatarRejectReason, setAvatarRejectReason] = useState('');
  const [showAvatarReject, setShowAvatarReject] = useState(false);
  const [avatarAuditing, setAvatarAuditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');          // 管理员重置密码
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const vStatus = user.verificationStatus || 'NONE';
  const isPending = vStatus === 'PENDING';
  // 头像是否待审核
  const avatarPending = user.avatarStatus === 'PENDING' && !!user.pendingAvatar;

  useEffect(() => {
    api.get<{ roles: { id: string; name: string; isSystem: boolean }[] }>('/api/admin/roles')
      .then(data => setCustomRoles(data.roles.filter(r => !r.isSystem)))
      .catch(() => {});
  }, []);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // 压缩到 256px, 避免大图拖慢保存
      const dataUrl = await compressImage(file, 256, 0.8);
      setAvatar(dataUrl);
    } catch { /* 忽略压缩失败 */ }
    e.target.value = '';
  };

  // 封面: 上传图片 (压缩到 1280px)
  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const dataUrl = await compressImage(file, 1280, 0.75);
      setCoverImage(dataUrl);
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  };

  // 封面: 移除
  const handleCoverRemove = () => {
    setCoverImage('');
  };

  // 头像审核: 通过 (将 pendingAvatar 应用为正式头像)
  const handleAvatarApprove = async () => {
    if (!confirm('确认通过该用户的头像审核?')) return;
    setAvatarAuditing(true); setErr('');
    try {
      await api.patch(`/api/admin/users/${user.id}`, { avatarStatus: 'APPROVED' });
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setAvatarAuditing(false); }
  };

  // 头像审核: 驳回
  const handleAvatarReject = async () => {
    const reason = avatarRejectReason.trim();
    if (!reason) { setErr('请填写驳回原因'); return; }
    setAvatarAuditing(true); setErr('');
    try {
      await api.patch(`/api/admin/users/${user.id}`, { avatarStatus: 'REJECTED', avatarRejectReason: reason });
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setAvatarAuditing(false); }
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const payload: any = { realName, remark, status, verified };
      if (email !== (user.email || '')) payload.email = email || '';
      if (phoneNumber !== (user.phoneNumber || '')) payload.phoneNumber = phoneNumber || '';
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
      // 密码重置: 非空时一并提交 (后端做 hash + 长度校验)
      if (newPassword.trim()) {
        if (newPassword.length < 6) { setErr('密码至少 6 位'); setSaving(false); return; }
        payload.password = newPassword;
      }
      // 封面: 有变更时提交 (空字符串表示移除)
      if (coverImage !== (user.coverImage || '')) payload.coverImage = coverImage || null;
      await api.patch(`/api/admin/users/${user.id}`, payload);
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };


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

          {/* 待审核头像: 旧头像 vs 新头像对比 + 通过/驳回 */}
          {avatarPending && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-orange-700">🟠 有新头像待审核</span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-600">待审核</span>
              </div>
              <div className="flex items-center justify-around gap-2">
                {/* 旧头像 */}
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-200">
                    {user.avatar ? <img src={user.avatar} alt="旧头像" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-400">无</div>}
                  </div>
                  <span className="mt-1 text-[11px] text-gray-500">当前头像</span>
                </div>
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {/* 新头像 (待审核) */}
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-orange-400">
                    <img src={user.pendingAvatar} alt="新头像" className="h-full w-full object-cover" />
                  </div>
                  <span className="mt-1 text-[11px] text-orange-600">新头像</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleAvatarApprove} disabled={avatarAuditing} className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50">
                  ✅ 通过
                </button>
                <button onClick={() => setShowAvatarReject(true)} disabled={avatarAuditing} className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                  ❌ 驳回
                </button>
              </div>
              {/* 驳回原因输入 */}
              {showAvatarReject && (
                <div className="mt-3 space-y-2">
                  <input value={avatarRejectReason} onChange={e => setAvatarRejectReason(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="请填写驳回原因 (将通知用户)" />
                  <div className="flex gap-2">
                    <button onClick={handleAvatarReject} disabled={avatarAuditing} className="flex-1 rounded-lg bg-red-500 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                      {avatarAuditing ? '处理中…' : '确认驳回'}
                    </button>
                    <button onClick={() => { setShowAvatarReject(false); setAvatarRejectReason(''); }} className="flex-1 rounded-lg bg-gray-100 py-1.5 text-xs text-gray-600">
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 上次头像驳回原因 */}
          {user.avatarStatus === 'REJECTED' && user.avatarRejectReason && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              上次头像驳回原因: {user.avatarRejectReason}
            </div>
          )}

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
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="选填" />
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

          {/* 资质/荣誉认证已移至独立的「资质/荣誉审核」标签页 */}
          <div className="rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2.5">
            <div className="text-xs text-purple-600">🏅 资质/荣誉认证请前往「资质/荣誉审核」标签页管理</div>
          </div>

          {/* 密码重置 (留空则不修改) */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5">
            <label className="block text-sm font-medium text-gray-700 mb-1">🔑 重置密码</label>
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="留空不修改; 填写后保存即重置 (至少 6 位)"
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-amber-700/80">管理员可强制重置用户密码, 保存后用户需用新密码登录。</p>
          </div>

          {/* 封面编辑: 直接上传 + 预览 + 删除 */}
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">封面图</label>
            <div className="flex items-start gap-3">
              {/* 缩略图预览 */}
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {coverImage ? (
                  <img src={coverImage} alt="封面预览" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-300">无预览</div>
                )}
              </div>
              {/* 上传 + 删除 */}
              <div className="flex flex-1 flex-col gap-2">
                <label className={`cursor-pointer rounded-lg bg-blue-500 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-600 ${coverUploading ? 'opacity-50' : ''}`}>
                  {coverUploading ? '上传中…' : (coverImage ? '重新上传' : '立即上传图片')}
                  <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                </label>
                {coverImage && (
                  <button
                    onClick={handleCoverRemove}
                    className="rounded-lg py-2 text-center text-sm font-medium text-red-500 hover:bg-red-50"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">上传图片会自动压缩到 1280px，删除后保存即清空封面</p>
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

// ---------- 积分调整弹窗 ----------
function PointsAdjustModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number>(user.points ?? 0);

  const loadLogs = () => {
    setLoadingLogs(true);
    api.get<{ items: any[] }>(`/api/admin/users/${user.id}/points`)
      .then(d => setLogs(d.items))
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  };
  useEffect(() => { loadLogs(); }, []);

  const doAdjust = async () => {
    if (amount === 0) { setErr('请输入变动积分 (正数增加, 负数扣除)'); return; }
    setSaving(true); setErr('');
    try {
      const res = await api.post<{ success: boolean; points: number }>(`/api/admin/users/${user.id}/points`, { amount, reason: reason.trim() || undefined });
      setCurrentPoints(res.points);
      onDone();
      loadLogs();
      setAmount(0); setReason('');
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const preview = currentPoints + amount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">调整积分</h3>
        <p className="text-sm text-gray-500 mb-4">用户: <span className="font-semibold text-gray-700">{user.nickname}</span> · 当前积分: <span className="font-semibold text-amber-600">{currentPoints}</span></p>

        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={() => setAmount(a => a + 10)} className="flex-1 rounded-lg bg-green-50 py-2 text-sm text-green-600 hover:bg-green-100">+10</button>
            <button onClick={() => setAmount(a => a + 50)} className="flex-1 rounded-lg bg-green-50 py-2 text-sm text-green-600 hover:bg-green-100">+50</button>
            <button onClick={() => setAmount(a => a + 100)} className="flex-1 rounded-lg bg-green-50 py-2 text-sm text-green-600 hover:bg-green-100">+100</button>
            <button onClick={() => setAmount(a => a - 10)} className="flex-1 rounded-lg bg-red-50 py-2 text-sm text-red-500 hover:bg-red-100">-10</button>
            <button onClick={() => setAmount(a => a - 50)} className="flex-1 rounded-lg bg-red-50 py-2 text-sm text-red-500 hover:bg-red-100">-50</button>
          </div>

          <div>
            <label className="text-xs text-gray-500">变动积分 (正数=赠与, 负数=扣除)</label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            {amount !== 0 && (
              <p className="mt-1 text-xs text-gray-500">变动后积分: <span className="font-semibold text-amber-600">{preview}</span>{preview < 0 && <span className="text-red-500"> (不能为负)</span>}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500">备注原因 (可选)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="如: 活动奖励、违规扣除等" maxLength={200} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>

          {err && <div className="text-sm text-red-500">{err}</div>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">关闭</button>
            <button onClick={doAdjust} disabled={saving || amount === 0 || preview < 0} className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {saving ? '提交中...' : amount > 0 ? '确认赠与' : '确认扣除'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">积分流水 (最近50条)</h4>
          {loadingLogs ? <p className="text-xs text-gray-400">加载中…</p> : logs.length === 0 ? (
            <p className="text-xs text-gray-400">暂无记录</p>
          ) : (
            <div className="space-y-1.5">
              {logs.map(l => (
                <div key={l.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                  <div>
                    <span className={`font-semibold ${l.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>{l.amount > 0 ? '+' : ''}{l.amount}</span>
                    <span className="ml-2 text-gray-500">{l.reason || '无备注'}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400">{l.admin?.nickname || '管理员'}</div>
                    <div className="text-gray-400">{new Date(l.createdAt).toLocaleString('zh-CN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

  const set = (k: string, v: string) => setCfg(prev => ({ ...prev, [k]: v }));
  const bool = (k: string, def = true) => cfg[k] === undefined ? def : cfg[k] === 'true';
  const setBool = (k: string, v: boolean) => set(k, String(v));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.patch('/api/admin/site-config', cfg);
      // 保存配置后自动同步数据库结构 (补全枚举值 / 创建缺失的表)
      try {
        const syncRes = await api.get<{ tables?: string[]; errors?: string[] }>('/api/admin/sync-db');
        const tables = syncRes?.tables?.length || 0;
        const errors = syncRes?.errors?.length || 0;
        setMsg(`保存成功 (数据库结构同步完成: ${tables} 张表${errors ? `, ${errors} 条警告` : ''})`);
      } catch (e: any) {
        setMsg(`保存成功, 但数据库结构同步失败: ${e.message}`);
      }
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
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
          <h3 className="font-semibold text-gray-900 mb-3">🎨 个人中心</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">个人中心背景图 URL</label>
            <input value={cfg.profile_bg || ''} onChange={e => set('profile_bg', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://...  (留空使用默认渐变)" />
            {cfg.profile_bg && (
              <div className="mt-2 h-20 rounded-lg overflow-hidden border border-gray-200" style={{ backgroundImage: `url(${cfg.profile_bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            )}
            <p className="mt-1 text-xs text-gray-400">建议上传 750x300 的图片, 管理员可在用户管理中单独修改用户头像</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">📝 帖子分类管理</label>
              <p className="text-xs text-gray-400 mb-3">勾选「需审核」的分类，用户发帖后需管理员审核通过才会显示。</p>

              {/* 分类列表 + 审核复选框 */}
              <div className="space-y-2 mb-3">
                {(cfg.post_categories || '').split(',').map(s => s.trim()).filter(Boolean).map((cat, idx, arr) => {
                  const reviewList = (cfg.review_categories || '').split(',').map(s => s.trim()).filter(Boolean);
                  const checked = reviewList.includes(cat);
                  return (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          setCfg(prev => {
                            const list = (prev.review_categories || '').split(',').map(s => s.trim()).filter(Boolean);
                            if (e.target.checked) { if (!list.includes(cat)) list.push(cat); }
                            else { const i = list.indexOf(cat); if (i >= 0) list.splice(i, 1); }
                            return { ...prev, review_categories: list.join(',') };
                          });
                        }}
                        className="h-4 w-4 shrink-0 accent-orange-500"
                      />
                      <span className="flex-1 text-sm font-medium text-gray-800">{cat}</span>
                      {checked && (
                        <span className="flex h-5 items-center rounded-full bg-orange-100 px-2 text-xs font-bold text-orange-600">需审核</span>
                      )}
                      <button
                        onClick={() => {
                          setCfg(prev => {
                            const newArr = (prev.post_categories || '').split(',').map(s => s.trim()).filter(Boolean).filter((_, i) => i !== idx);
                            const rl = (prev.review_categories || '').split(',').map(s => s.trim()).filter(Boolean);
                            const ri = rl.indexOf(cat);
                            if (ri >= 0) rl.splice(ri, 1);
                            return { ...prev, post_categories: newArr.join(','), review_categories: rl.join(',') };
                          });
                        }}
                        className="text-xs text-red-500 hover:text-red-700 shrink-0"
                      >
                        删除
                      </button>
                    </div>
                  );
                })}
                {(cfg.post_categories || '').split(',').map(s => s.trim()).filter(Boolean).length === 0 && (
                  <p className="text-sm text-gray-400 py-2">暂无分类，请在下方添加</p>
                )}
              </div>

              {/* 添加新分类 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  id="new-category-input"
                  placeholder="输入新分类名称"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (!val) return;
                      setCfg(prev => {
                        const list = (prev.post_categories || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!list.includes(val)) list.push(val);
                        return { ...prev, post_categories: list.join(',') };
                      });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('new-category-input') as HTMLInputElement;
                    const val = input?.value.trim();
                    if (!val) return;
                    setCfg(prev => {
                      const list = (prev.post_categories || '').split(',').map(s => s.trim()).filter(Boolean);
                      if (!list.includes(val)) list.push(val);
                      return { ...prev, post_categories: list.join(',') };
                    });
                    if (input) input.value = '';
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  添加
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">勾选需要审核的分类即可，管理员可随时调整。</p>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最大同登账号数</label>
                <input type="number" min="1" max="10" value={cfg.max_accounts || '3'} onChange={e => set('max_accounts', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="3" />
              </div>
              <div className="flex items-end">
                <p className="text-xs text-gray-400">同一设备最多可同时登录的账号数量</p>
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

        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-1">🔐 开放登录方式</h3>
          <p className="text-xs text-gray-400 mb-3">勾选后用户可在登录页使用该方式快捷登录</p>

          {/* 彩虹云 API 凭证 */}
          <div className="mb-4 rounded-lg bg-blue-50/50 p-3 space-y-3">
            <div className="text-xs text-blue-700 font-medium">彩虹云 (u.cccyun.cc) API 凭证</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">App ID</label>
                <input
                  value={cfg.juhe_app_id || ''}
                  onChange={e => set('juhe_app_id', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="彩虹云 App ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">App Key</label>
                <input
                  type="password"
                  value={cfg.juhe_app_key || ''}
                  onChange={e => set('juhe_app_key', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="彩虹云 App Key"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">填写后即可启用第三方登录; 留空时将回退使用服务器环境变量 JUHE_APP_ID / JUHE_APP_KEY</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {JUHE_TYPES.map(t => {
              const open = (cfg.open_login_types || '').split(',').includes(t.type);
              return (
                <label key={t.type} className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition ${open ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={e => {
                      const list = (cfg.open_login_types || '').split(',').filter(Boolean);
                      if (e.target.checked) list.push(t.type);
                      else { const i = list.indexOf(t.type); if (i >= 0) list.splice(i, 1); }
                      set('open_login_types', list.join(','));
                    }}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-gray-100">
                    <BrandIcon type={t.type} size={18} />
                  </span>
                  <span className="text-sm font-medium text-gray-700">{t.label}</span>
                </label>
              );
            })}
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
    else if (['email', '邮箱', '电子邮件'].includes(key)) out.email = val;
    else if (['phone', '手机', '手机号', '电话', 'phonenumber'].includes(key)) {
      // 尝试分离区号和号码
      const m = val.match(/(\+\d{1,4})?[-\s]?([\d-]+)/);
      if (m) {
        if (m[1]) out.countryCode = m[1];
        out.phoneNumber = (m[2] || val).replace(/-/g, '');
      } else {
        out.phoneNumber = val.replace(/\D/g, '');
      }
    }
    else if (['nickname', '昵称'].includes(key)) out.nickname = val;
  }
  return out;
}

function VerificationReviewTab({ isSuper }: { isSuper: boolean }) {
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
  // 提取的头像 base64 + 是否设为用户头像
  const [extractedAvatar, setExtractedAvatar] = useState<string>('');
  const [setAsAvatar, setSetAsAvatar] = useState(true);

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
      // 头像字段跳过 (不是文本字段)
      if (['avatar', '头像', 'photo', '照片'].includes(norm)) continue;
      merged[k] = v;
    }
    setFields(merged);
    setRejectMode(false);
    setRejectReason('');
    setCustomReason('');
    setReviewTarget(u);
    setExtractedAvatar('');
    setSetAsAvatar(true);

    // 如果 AI 结果中有头像 bbox, 用 canvas 从认证照片中裁剪
    if (ai.avatarBbox && u.verificationPhoto) {
      extractAvatar(u.verificationPhoto, ai.avatarBbox).then(dataUrl => {
        if (dataUrl) setExtractedAvatar(dataUrl);
      }).catch(() => {});
    }
  };

  // 用 canvas 从认证照片中裁剪头像区域
  const extractAvatar = (photoSrc: string, bbox: { x: number; y: number; w: number; h: number }): Promise<string | null> => {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const sx = Math.max(0, bbox.x * img.width);
        const sy = Math.max(0, bbox.y * img.height);
        const sw = Math.max(1, bbox.w * img.width);
        const sh = Math.max(1, bbox.h * img.height);
        // 限制最大尺寸 400px
        const maxDim = 400;
        let dw = sw, dh = sh;
        if (Math.max(sw, sh) > maxDim) {
          const scale = maxDim / Math.max(sw, sh);
          dw = Math.round(sw * scale);
          dh = Math.round(sh * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = photoSrc;
    });
  };

  const doApprove = async () => {
    if (!reviewTarget) return;
    if (!confirm('确认通过该用户的实名认证? 将同步更新其姓名/学号等信息。')) return;
    setBusy(true);
    try {
      const mapped = mapFieldsToUser(fields);
      const payload: any = {
        verificationStatus: 'APPROVED',
        realName: mapped.realName || undefined,
        studentId: mapped.studentId || undefined,
        grade: mapped.grade || undefined,
        className: mapped.className || undefined,
      };
      // 自动填充邮箱/手机号/昵称 (仅当识别到值时)
      if (mapped.email) payload.email = mapped.email;
      if (mapped.phoneNumber) {
        payload.phoneNumber = mapped.phoneNumber;
        if (mapped.countryCode) payload.countryCode = mapped.countryCode;
      }
      if (mapped.nickname) payload.nickname = mapped.nickname;
      // 如果提取到了头像且勾选"设为用户头像", 一并更新
      if (extractedAvatar && setAsAvatar) payload.avatar = extractedAvatar;
      await api.patch(`/api/admin/users/${reviewTarget.id}`, payload);
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

  // 撤回已通过的身份认证 (仅超级管理员)
  const revokeVerification = async (id: string) => {
    if (!confirm('确认撤回该用户的身份认证? 撤回后将重新进入审核队列。')) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/users/${id}`, { verificationStatus: 'PENDING' });
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
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                        {u.nickname} <span className="text-gray-400 font-normal">· {u.role}</span>
                        {u.verificationTemplate?.type && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {u.verificationTemplate.type === 'STUDENT' ? '学生认证' : u.verificationTemplate.type === 'TEACHER' ? '老师认证' : '资质认证'}
                          </span>
                        )}
                        {u.verificationPhotoType && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.verificationPhotoType === 'FACE' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {u.verificationPhotoType === 'FACE' ? '😊 人脸' : '💳 卡面'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{u.realName || '未填写真名'} {u.studentId ? `· 学号 ${u.studentId}` : ''}</div>
                    </div>
                  </div>
                  {statusBadge(u.verificationStatus)}
                </div>

                {u.verificationStatus === 'REJECTED' && u.verificationRejectReason && (
                  <div className="mt-2 text-xs text-red-500">驳回原因: {u.verificationRejectReason}</div>
                )}

                {u.aiImageCheck && (
                  <AiCheckBadge check={u.aiImageCheck} />
                )}

                {isReviewable && (
                  <button
                    onClick={() => openReview(u)}
                    className="mt-3 w-full rounded-lg bg-blue-50 py-2 text-sm text-blue-600 hover:bg-blue-100"
                  >
                    进入人工复审
                  </button>
                )}
                {u.verificationStatus === 'APPROVED' && isSuper && (
                  <button
                    onClick={() => revokeVerification(u.id)}
                    className="mt-3 w-full rounded-lg bg-amber-50 py-2 text-sm text-amber-600 hover:bg-amber-100"
                  >
                    ↩️ 撤回到审核中
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

            {/* 提取的头像预览 */}
            {extractedAvatar && (
              <div className="mt-4 flex items-center gap-4 rounded-xl bg-blue-50 p-3">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-blue-300 flex items-center justify-center bg-white">
                  <img src={extractedAvatar} alt="提取的头像" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-800">已从校园卡提取头像</div>
                  <div className="text-xs text-blue-600 mt-0.5">通过认证时将自动设为用户头像</div>
                </div>
                <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={setAsAvatar} onChange={e => setSetAsAvatar(e.target.checked)} className="h-4 w-4" />
                  设为头像
                </label>
              </div>
            )}

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
        <div className="space-y-2">
          {roles.map(r => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  {r.isSystem ? (
                    <span className="text-gray-300 text-sm">—</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="rounded border-gray-300"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.isSystem
                      ? <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">系统</span>
                      : <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">自定义</span>
                    }
                    {r.isDefault && <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">默认</span>}
                  </div>
                  <div className="mt-1.5 text-xs text-gray-500">
                    {r.userCount} 个用户 · {r.permissions.length} 项权限
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 pl-7">
                <button onClick={() => setEditing(r)} className="flex-1 rounded-lg bg-blue-50 py-1.5 text-sm text-blue-600 hover:bg-blue-100">编辑</button>
                {!r.isSystem && (
                  <button onClick={() => handleDelete(r)} className="flex-1 rounded-lg bg-red-50 py-1.5 text-sm text-red-500 hover:bg-red-100">删除</button>
                )}
              </div>
            </div>
          ))}
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

// ---------- 学校管理 ----------
const SCHOOL_STAGES = ['幼儿园', '小学', '初中', '高中', '大学', '其他'];

function SchoolsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: any[] }>('/api/schools').then(d => setItems(d.items || [])).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { setErr('请输入学校名称'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/api/schools', { name: name.trim(), description: description.trim() });
      setName(''); setDescription('');
      load();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const update = async (id: string) => {
    if (!editName.trim()) { setErr('请输入学校名称'); return; }
    setSaving(true); setErr('');
    try {
      await api.patch(`/api/schools/${id}`, {
        name: editName.trim(),
        stage: editStage,
        description: editDesc.trim(),
      });
      setEditId(null);
      load();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该学校? 关联用户将解除绑定')) return;
    try { await api.del(`/api/schools/${id}`); load(); } catch (e: any) { setErr(e.message); }
  };

  if (loading) return <div className="py-8 text-center text-gray-400">加载中…</div>;

  return (
    <div>
      <SectionTitle title="学校管理" desc="添加学校名称, 可编辑补充学段 (如初中/高中/大学) 等信息" />
      {err && <p className="mb-3 text-sm text-red-500">{err}</p>}

      {/* 新建表单: 只需学校名称 */}
      <div className="mb-5 rounded-2xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="学校名称" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="简介 (选填)" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
        </div>
        <button onClick={create} disabled={saving} className="mt-3 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
          {saving ? '创建中…' : '+ 添加学校'}
        </button>
      </div>

      {/* 列表 */}
      <div className="space-y-2">
        {items.length === 0 && <p className="py-8 text-center text-sm text-gray-400">暂无学校</p>}
        {items.map(s => (
          <div key={s.id} className="rounded-2xl border border-gray-200 p-4">
            {editId === s.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="学校名称" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  <select value={editStage} onChange={e => setEditStage(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
                    <option value="">选择学段</option>
                    {SCHOOL_STAGES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="简介" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 sm:col-span-2" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => update(s.id)} disabled={saving} className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white disabled:opacity-50">保存</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600">取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {s.name}
                    {s.stage && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{s.stage}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {s._count?.users || 0} 名成员
                    {s.description && ` · ${s.description}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditStage(s.stage || ''); setEditDesc(s.description || ''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">编辑</button>
                  <button onClick={() => remove(s.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50">删除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 团体管理 ----------
function OrgsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: any[] }>('/api/orgs').then(d => setItems(d.items || [])).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { setErr('请输入团体名称'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/api/orgs', { name: name.trim(), description: description.trim() });
      setName(''); setDescription('');
      load();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const update = async (id: string) => {
    if (!editName.trim()) { setErr('请输入团体名称'); return; }
    setSaving(true); setErr('');
    try {
      await api.patch(`/api/orgs/${id}`, { name: editName.trim(), description: editDesc.trim() });
      setEditId(null);
      load();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该团体? 关联用户将解除绑定')) return;
    try { await api.del(`/api/orgs/${id}`); load(); } catch (e: any) { setErr(e.message); }
  };

  if (loading) return <div className="py-8 text-center text-gray-400">加载中…</div>;

  return (
    <div>
      <SectionTitle title="团体管理" desc="创建非学校类团体 (如社团/救援队/志愿者团队等), 用户可选择归属" />
      {err && <p className="mb-3 text-sm text-red-500">{err}</p>}

      <div className="mb-5 rounded-2xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="团体名称" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="简介 (选填)" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
        </div>
        <button onClick={create} disabled={saving} className="mt-3 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
          {saving ? '创建中…' : '+ 添加团体'}
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="py-8 text-center text-sm text-gray-400">暂无团体</p>}
        {items.map(o => (
          <div key={o.id} className="rounded-2xl border border-gray-200 p-4">
            {editId === o.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => update(o.id)} disabled={saving} className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white disabled:opacity-50">保存</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600">取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{o.name}</div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {o._count?.users || 0} 名成员{o.description && ` · ${o.description}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditId(o.id); setEditName(o.name); setEditDesc(o.description || ''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">编辑</button>
                  <button onClick={() => remove(o.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50">删除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 资质/荣誉认证审核 ----------
function QualificationReviewTab({ isSuper }: { isSuper: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [category, setCategory] = useState<'QUALIFICATION' | 'HONOR' | ''>('');
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [displayPhoto, setDisplayPhoto] = useState<'photo' | 'photo2'>('photo');
  const [editType, setEditType] = useState('');          // 管理员可修改资质名称
  const [editCategory, setEditCategory] = useState<'QUALIFICATION' | 'HONOR'>('QUALIFICATION');
  const [previewImg, setPreviewImg] = useState<string | null>(null); // 图片放大预览
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErr('');
    const params = new URLSearchParams({ status: filter });
    if (category) params.set('category', category);
    api.get<{ items: any[] }>(`/api/admin/qualifications?${params}`)
      .then(d => setItems(d.items || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filter, category]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    if (!confirm('确认通过该资质/荣誉认证?')) return;
    setBusy(true);
    try {
      const payload: any = { status: 'APPROVED', displayPhoto };
      // 若管理员修改了名称/类别, 一并提交
      if (editType.trim() && editType.trim() !== reviewTarget.type) payload.type = editType.trim();
      if (editCategory !== reviewTarget.category) payload.category = editCategory;
      await api.patch(`/api/admin/qualifications/${id}`, payload);
      setReviewTarget(null);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  // 单独保存名称/类别修改 (不改变审核状态, 适用于已通过/已驳回的记录也要改名)
  const saveEdit = async (id: string) => {
    setBusy(true);
    try {
      const payload: any = {};
      if (editType.trim() && editType.trim() !== reviewTarget.type) payload.type = editType.trim();
      if (editCategory !== reviewTarget.category) payload.category = editCategory;
      if (Object.keys(payload).length === 0) { alert('未做修改'); return; }
      await api.patch(`/api/admin/qualifications/${id}`, payload);
      setReviewTarget(null);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { alert('请填写驳回原因'); return; }
    setBusy(true);
    try {
      await api.patch(`/api/admin/qualifications/${id}`, { status: 'REJECTED', rejectReason: rejectReason.trim() });
      setReviewTarget(null);
      setRejectReason('');
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  // 撤回已通过的资质/荣誉认证 (仅超级管理员)
  const revoke = async (id: string) => {
    if (!confirm('确认撤回该资质/荣誉认证? 撤回后将重新进入审核队列。')) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/qualifications/${id}`, { status: 'PENDING' });
      load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING: 'bg-amber-100 text-amber-700',
      REJECTED: 'bg-red-100 text-red-700',
    };
    const label: Record<string, string> = { APPROVED: '已通过', PENDING: '待审核', REJECTED: '已驳回' };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-600'}`}>{label[s] || s}</span>;
  };

  return (
    <div>
      <SectionTitle title="资质/荣誉认证审核" desc="审核用户提交的资质认证 (身份标签) 和荣誉认证, 通过后将展示在用户个人主页" />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === f ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {f === 'PENDING' ? '待审核' : f === 'ALL' ? '全部' : f === 'APPROVED' ? '已通过' : '已驳回'}
          </button>
        ))}
        <select value={category} onChange={e => setCategory(e.target.value as any)} className="rounded-full border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">全部类别</option>
          <option value="QUALIFICATION">资质认证</option>
          <option value="HONOR">荣誉认证</option>
        </select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">加载中…</div>
      ) : err ? (
        <div className="py-8 text-center text-red-500">{err}</div>
      ) : items.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
          <div className="text-4xl">🎖️</div>
          <span className="text-sm">暂无资质/荣誉认证申请</span>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(q => (
            <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {q.user?.avatar ? <img src={q.user.avatar} alt="" className="h-full w-full object-cover" /> : (q.user?.nickname || 'U')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{q.user?.nickname}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${q.category === 'HONOR' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                        {q.category === 'HONOR' ? '🏆 荣誉' : '🎖️ 资质'}
                      </span>
                      {statusBadge(q.status)}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-700 font-medium">{q.type}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {q.user?.realName ? q.user.realName + ' · ' : ''}{q.user?.grade || ''}{q.user?.className || ''} · {fmtDate(q.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => { setReviewTarget(q); setRejectReason(''); setDisplayPhoto(q.displayPhoto === 'photo2' ? 'photo2' : 'photo'); setEditType(q.type || ''); setEditCategory(q.category || 'QUALIFICATION'); }}
                    className={`rounded-lg px-3 py-1.5 text-xs ${q.status === 'PENDING' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    {q.status === 'PENDING' ? '审核' : '✏️ 编辑'}
                  </button>
                  {q.status === 'APPROVED' && isSuper && (
                    <button onClick={() => revoke(q.id)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-100">↩️ 撤回</button>
                  )}
                </div>
              </div>
              {(q.photo || q.photo2) && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">证明材料 (点击图片放大) {q.displayPhoto && <span className="text-blue-500">(公开展示: {q.displayPhoto === 'photo2' ? '反面' : '正面'})</span>}</div>
                  <div className="flex gap-2 flex-wrap">
                    {q.photo && (
                      <div className="relative cursor-zoom-in" onClick={() => setPreviewImg(q.photo)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.photo} alt="证明材料正面" className="max-h-40 rounded-lg border border-gray-200 object-contain" />
                        <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">正面</span>
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">🔍 放大</span>
                      </div>
                    )}
                    {q.photo2 && (
                      <div className="relative cursor-zoom-in" onClick={() => setPreviewImg(q.photo2)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.photo2} alt="证明材料反面" className="max-h-40 rounded-lg border border-gray-200 object-contain" />
                        <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">反面</span>
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">🔍 放大</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {q.rejectReason && (
                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">驳回原因: {q.rejectReason}</div>
              )}
              {q.aiImageCheck && <AiCheckBadge check={q.aiImageCheck} />}
            </div>
          ))}
        </div>
      )}

      {/* 审核弹窗 */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReviewTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{reviewTarget.status === 'PENDING' ? '审核' : '编辑'}{reviewTarget.category === 'HONOR' ? '荣誉' : '资质'}认证</h3>
              <button onClick={() => setReviewTarget(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  {reviewTarget.user?.avatar ? <img src={reviewTarget.user.avatar} alt="" className="h-full w-full object-cover" /> : (reviewTarget.user?.nickname || 'U')[0]}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{reviewTarget.user?.nickname}</div>
                  <div className="text-xs text-gray-400">{reviewTarget.user?.realName || ''}</div>
                </div>
              </div>
              {/* 管理员可修改资质/荣誉名称和类别 */}
              <div className="rounded-lg bg-amber-50/60 border border-amber-200 p-3 space-y-2">
                <div className="text-xs font-medium text-amber-700">✏️ 可修改认证信息 (改名后用户主页同步更新)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">认证名称</label>
                    <input value={editType} onChange={e => setEditType(e.target.value)} placeholder="如: 学生会主席"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">类别</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value as 'QUALIFICATION' | 'HONOR')}
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      <option value="QUALIFICATION">资质</option>
                      <option value="HONOR">荣誉</option>
                    </select>
                  </div>
                </div>
              </div>
              {(reviewTarget.photo || reviewTarget.photo2) && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">证明材料 (点图选公开展示面, 点🔍放大)</div>
                  <div className="grid grid-cols-2 gap-2">
                    {reviewTarget.photo ? (
                      <div
                        className={`relative rounded-lg border-2 overflow-hidden transition ${displayPhoto === 'photo' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                      >
                        <button type="button" onClick={() => setDisplayPhoto('photo')} className="block w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reviewTarget.photo} alt="正面" className="w-full max-h-56 object-contain bg-gray-50" />
                        </button>
                        <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">正面</span>
                        {displayPhoto === 'photo' && <span className="absolute top-1 right-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">展示中</span>}
                        <button type="button" onClick={() => setPreviewImg(reviewTarget.photo)} className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80">🔍 放大</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-xs text-gray-400">无正面</div>
                    )}
                    {reviewTarget.photo2 ? (
                      <div
                        className={`relative rounded-lg border-2 overflow-hidden transition ${displayPhoto === 'photo2' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                      >
                        <button type="button" onClick={() => setDisplayPhoto('photo2')} className="block w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reviewTarget.photo2} alt="反面" className="w-full max-h-56 object-contain bg-gray-50" />
                        </button>
                        <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">反面</span>
                        {displayPhoto === 'photo2' && <span className="absolute top-1 right-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">展示中</span>}
                        <button type="button" onClick={() => setPreviewImg(reviewTarget.photo2)} className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80">🔍 放大</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-xs text-gray-400">无反面</div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">通过后将以所选面展示在用户个人主页</p>
                </div>
              )}
              {reviewTarget.status === 'PENDING' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">驳回原因 (驳回时填写)</label>
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="如: 证明材料不清晰或信息不符"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
              )}
              {reviewTarget.aiImageCheck && (
                <div className="rounded-lg bg-gray-50 p-2"><AiCheckBadge check={reviewTarget.aiImageCheck} /></div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              {reviewTarget.status === 'PENDING' ? (
                <>
                  <button onClick={() => reject(reviewTarget.id)} disabled={busy} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">{busy ? '处理中…' : '驳回'}</button>
                  <button onClick={() => approve(reviewTarget.id)} disabled={busy} className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{busy ? '处理中…' : '通过'}</button>
                </>
              ) : (
                <>
                  <button onClick={() => setReviewTarget(null)} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200">取消</button>
                  <button onClick={() => saveEdit(reviewTarget.id)} disabled={busy} className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">{busy ? '处理中…' : '保存修改'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 图片放大预览 (lightbox) */}
      {previewImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImg(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl leading-none hover:opacity-70" onClick={() => setPreviewImg(null)}>✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImg} alt="放大预览" className="max-h-[92vh] max-w-[95vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ---------- 头像审核 ----------
function AvatarReviewTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: any[] }>('/api/admin/avatar-reviews');
      setItems(d.items || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // 通过: pendingAvatar -> avatar
  const approve = async (id: string) => {
    if (!confirm('确认通过该头像审核?')) return;
    setBusyId(id);
    try {
      await api.patch(`/api/admin/users/${id}`, { avatarStatus: 'APPROVED' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) { alert(e.message || '操作失败'); }
    finally { setBusyId(null); }
  };

  // 驳回
  const doReject = async (id: string) => {
    const reason = rejectReason.trim();
    if (!reason) { alert('请填写驳回原因'); return; }
    setBusyId(id);
    try {
      await api.patch(`/api/admin/users/${id}`, { avatarStatus: 'REJECTED', avatarRejectReason: reason });
      setItems(prev => prev.filter(i => i.id !== id));
      setRejectId(null); setRejectReason('');
    } catch (e: any) { alert(e.message || '操作失败'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="头像审核" desc="用户上传的新头像在此审核。AI 自动过滤明显违规内容，不确定的进入人工审核。" />
      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">加载中…</p>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-sm">暂无待审核头像</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(u => (
            <div key={u.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium text-gray-800">{u.nickname}</span>
                <span className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              {/* 旧头像 vs 新头像 对比 */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center">
                  <span className="mb-1 text-xs text-gray-400">当前头像</span>
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-gray-100 ring-2 ring-gray-200">
                    {u.avatar ? <img src={u.avatar} alt="旧头像" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-300">无</div>}
                  </div>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div className="flex flex-col items-center">
                  <span className="mb-1 text-xs text-orange-500">待审核</span>
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-gray-100 ring-2 ring-orange-300">
                    {u.pendingAvatar ? <img src={u.pendingAvatar} alt="新头像" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-300">无</div>}
                  </div>
                </div>
              </div>
              {/* 操作按钮 */}
              {rejectId === u.id ? (
                <div className="mt-4 space-y-2">
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="请填写驳回原因 (将通知用户)" />
                  <div className="flex gap-2">
                    <button onClick={() => doReject(u.id)} disabled={busyId === u.id} className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                      {busyId === u.id ? '处理中…' : '确认驳回'}
                    </button>
                    <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">取消</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => approve(u.id)} disabled={busyId === u.id} className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50">
                    {busyId === u.id ? '处理中…' : '✓ 通过'}
                  </button>
                  <button onClick={() => setRejectId(u.id)} disabled={busyId === u.id} className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                    ✗ 驳回
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 快捷通道管理 ----------
function QuickLinksManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [err, setErr] = useState('');

  const load = () => {
    api.get<{ items: any[] }>('/api/admin/quick-links')
      .then(d => setItems(d.items))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ title: '', url: '', icon: '', sortOrder: 0, isActive: true }); setShowForm(true); setErr(''); };
  const openEdit = (item: any) => { setEditing({ ...item }); setShowForm(true); setErr(''); };

  const save = async () => {
    if (!editing.title.trim() || !editing.url.trim()) { setErr('请填写名称和链接'); return; }
    try {
      if (editing.id) {
        await api.patch(`/api/admin/quick-links/${editing.id}`, editing);
      } else {
        await api.post('/api/admin/quick-links', editing);
      }
      setShowForm(false); load();
    } catch (e: any) { setErr(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该快捷通道?')) return;
    try { await api.del(`/api/admin/quick-links/${id}`); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const b64 = await compressImage(f, 512, 0.7); setEditing({ ...editing, icon: b64 }); }
    catch { alert('图片处理失败'); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try { await api.patch(`/api/admin/quick-links/${id}`, { isActive: !current }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle title="快捷通道管理" desc="管理首页快捷通道, 点击次数多的自动排前" />
        <button onClick={openNew} className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">+ 新增</button>
      </div>
      {err && <div className="text-sm text-red-500">{err}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div className="flex gap-3">
            <div className="space-y-2">
              <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                {editing.icon ? <img src={editing.icon} alt="" className="h-full w-full object-cover" /> : <span className="text-gray-300">图标</span>}
              </div>
              <label className="block text-center text-xs text-blue-500 cursor-pointer">
                上传<input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="名称" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="链接 URL" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input type="number" value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })} className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" /> 排序
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input type="checkbox" checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} /> 启用
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">保存</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200">取消</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">加载中…</p> : (
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {/* 图标 */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center">
                  {it.icon && <img src={it.icon} alt="" className="h-full w-full object-cover" />}
                </div>
                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{it.title}</span>
                    {it.isActive
                      ? <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">启用</span>
                      : <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">禁用</span>
                    }
                  </div>
                  <div className="mt-1 text-xs text-gray-400 truncate">{it.url}</div>
                  <div className="mt-1 text-xs text-gray-400">点击 {it.clickCount} 次 · 排序 {it.sortOrder}</div>
                </div>
              </div>
              {/* 操作按钮 */}
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(it)} className="flex-1 rounded-lg bg-blue-50 py-1.5 text-sm text-blue-600 hover:bg-blue-100">编辑</button>
                <button onClick={() => toggleActive(it.id, it.isActive)} className={`flex-1 rounded-lg py-1.5 text-sm hover:bg-gray-100 ${it.isActive ? 'bg-gray-50 text-gray-600' : 'bg-green-50 text-green-600'}`}>
                  {it.isActive ? '禁用' : '启用'}
                </button>
                <button onClick={() => remove(it.id)} className="flex-1 rounded-lg bg-red-50 py-1.5 text-sm text-red-500 hover:bg-red-100">删除</button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center text-gray-400 shadow-sm">暂无数据</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 积分商城管理 ----------
function ShopManager() {
  const [tab, setTab] = useState<'items' | 'exchanges'>('items');
  const [items, setItems] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [err, setErr] = useState('');
  const [fulfillTarget, setFulfillTarget] = useState<any>(null);
  const [viewTarget, setViewTarget] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get<{ items: any[] }>('/api/admin/shop/items')
      .then(d => setItems(d.items))
      .catch(e => setErr(e.message));
    api.get<{ items: any[] }>('/api/admin/shop/exchanges')
      .then(d => setExchanges(d.items))
      .catch(() => {});
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ name: '', description: '', image: '', pointsCost: 100, stock: -1, isActive: true }); setShowForm(true); setErr(''); };
  const openEdit = (item: any) => { setEditing({ ...item }); setShowForm(true); setErr(''); };

  const save = async () => {
    if (!editing.name.trim()) { setErr('请填写商品名称'); return; }
    try {
      if (editing.id) { await api.patch(`/api/admin/shop/items/${editing.id}`, editing); }
      else { await api.post('/api/admin/shop/items', editing); }
      setShowForm(false); load();
    } catch (e: any) { setErr(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该商品?')) return;
    try { await api.del(`/api/admin/shop/items/${id}`); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const updateExchange = async (id: string, status: string) => {
    try { await api.patch(`/api/admin/shop/exchanges/${id}`, { status }); load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const b64 = await compressImage(f, 800, 0.7); setEditing({ ...editing, image: b64 }); }
    catch { alert('图片处理失败'); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try { await api.patch(`/api/admin/shop/items/${id}`, { isActive: !current }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const statusLabel = (s: string) => {
    if (s === 'FULFILLED') return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">已发放</span>;
    if (s === 'CANCELLED') return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">已取消</span>;
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">待发放</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle title="积分商城管理" desc="管理兑换商品与兑换记录" />
        {tab === 'items' && <button onClick={openNew} className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600">+ 新增商品</button>}
      </div>
      {err && <div className="text-sm text-red-500">{err}</div>}

      <div className="flex gap-2">
        <button onClick={() => setTab('items')} className={`rounded-lg px-4 py-2 text-sm ${tab === 'items' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>商品管理</button>
        <button onClick={() => setTab('exchanges')} className={`rounded-lg px-4 py-2 text-sm ${tab === 'exchanges' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>兑换记录</button>
      </div>

      {showForm && tab === 'items' && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <div className="flex gap-4">
            <div className="space-y-2">
              <div className="h-24 w-24 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                {editing.image ? <img src={editing.image} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl text-gray-300">🎁</span>}
              </div>
              <label className="block text-center text-xs text-blue-500 cursor-pointer">
                上传图片<input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="商品名称" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="商品描述" rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">所需积分</label>
                  <input type="number" value={editing.pointsCost} onChange={e => setEditing({ ...editing, pointsCost: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">库存 (-1不限)</label>
                  <input type="number" value={editing.stock} onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <label className="flex items-end gap-1 text-sm text-gray-600">
                  <input type="checkbox" checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} /> 上架
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600">保存</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200">取消</button>
          </div>
        </div>
      )}

      {tab === 'items' ? (
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center text-2xl">
                  {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : <span>🎁</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{it.name}</span>
                    {it.isActive
                      ? <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">上架</span>
                      : <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">下架</span>
                    }
                  </div>
                  {it.description && <div className="mt-1 text-xs text-gray-400 line-clamp-1">{it.description}</div>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                    <span className="text-amber-600 font-medium">{it.pointsCost} 积分</span>
                    <span>库存 {it.stock === -1 ? '不限' : it.stock}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(it)} className="flex-1 rounded-lg bg-blue-50 py-1.5 text-sm text-blue-600 hover:bg-blue-100">编辑</button>
                <button onClick={() => toggleActive(it.id, it.isActive)} className={`flex-1 rounded-lg py-1.5 text-sm ${it.isActive ? 'bg-gray-50 text-gray-600 hover:bg-gray-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                  {it.isActive ? '下架' : '上架'}
                </button>
                <button onClick={() => remove(it.id)} className="flex-1 rounded-lg bg-red-50 py-1.5 text-sm text-red-500 hover:bg-red-100">删除</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-gray-400 shadow-sm">暂无商品</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {exchanges.map(r => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{r.user?.nickname || '未知用户'}</span>
                    {statusLabel(r.status)}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{r.item?.name || '已删除商品'}</div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                    <span className="text-amber-600 font-medium">{r.pointsCost} 积分</span>
                    <span>{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
              {r.status === 'PENDING' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setFulfillTarget(r)} className="flex-1 rounded-lg bg-green-50 py-1.5 text-sm text-green-600 hover:bg-green-100">发放</button>
                  <button onClick={() => updateExchange(r.id, 'CANCELLED')} className="flex-1 rounded-lg bg-red-50 py-1.5 text-sm text-red-500 hover:bg-red-100">取消</button>
                </div>
              )}
              {r.status === 'FULFILLED' && (
                <div className="mt-3">
                  <button onClick={() => setViewTarget(r)} className="w-full rounded-lg bg-blue-50 py-1.5 text-sm text-blue-600 hover:bg-blue-100">查看发放</button>
                </div>
              )}
            </div>
          ))}
          {exchanges.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-gray-400 shadow-sm">暂无兑换记录</div>}
        </div>
      )}

      {fulfillTarget && <FulfillModal record={fulfillTarget} onClose={() => setFulfillTarget(null)} onDone={() => { load(); setFulfillTarget(null); }} />}
      {viewTarget && <FulfillDetailModal record={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

// ---------- 发放弹窗 ----------
const FULFILLMENT_TYPES = [
  { value: 'SELF_PICKUP', label: '线下自提', icon: '🏪', desc: '用户到指定地点自取', fields: [{ key: 'address', label: '自提地址' }, { key: 'time', label: '自提时间' }, { key: 'contact', label: '联系电话' }] },
  { value: 'EXPRESS', label: '快递邮寄', icon: '📦', desc: '通过快递寄送', fields: [{ key: 'company', label: '快递公司' }, { key: 'trackingNo', label: '快递单号' }] },
  { value: 'VIRTUAL_CODE', label: '虚拟兑换码', icon: '🎫', desc: '发放兑换码给用户', fields: [{ key: 'code', label: '兑换码' }, { key: 'expireAt', label: '有效期(可选)' }] },
  { value: 'ONLINE', label: '线上发放', icon: '⚡', desc: '直接到账(会员/积分/优惠券等)', fields: [{ key: 'account', label: '发放账户' }, { key: 'detail', label: '发放说明' }] },
  { value: 'CONTACT', label: '联系管理员', icon: '💬', desc: '用户联系管理员领取', fields: [{ key: 'contact', label: '管理员联系方式' }, { key: 'note', label: '备注说明' }] },
  { value: 'OTHER', label: '其他方式', icon: '📝', desc: '其他发放方式', fields: [{ key: 'detail', label: '发放说明' }] },
];

function FulfillModal({ record, onClose, onDone }: { record: any; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const currentType = FULFILLMENT_TYPES.find(t => t.value === type);

  const doFulfill = async () => {
    if (!type) { setErr('请选择发放方式'); return; }
    const info = currentType ? Object.fromEntries(currentType.fields.map(f => [f.label, fields[f.key] || ''])) : {};
    setSaving(true); setErr('');
    try {
      await api.patch(`/api/admin/shop/exchanges/${record.id}`, {
        status: 'FULFILLED',
        fulfillmentType: type,
        fulfillmentInfo: JSON.stringify(info),
      });
      onDone();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">发放兑换商品</h3>
        <p className="text-sm text-gray-500 mb-4">商品: <span className="font-semibold text-gray-700">{record.item?.name}</span> · 用户: {record.user?.nickname}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">选择发放方式</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FULFILLMENT_TYPES.map(t => (
                <button key={t.value} onClick={() => { setType(t.value); setFields({}); }}
                  className={`rounded-xl border p-3 text-center transition ${type === t.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-xs font-medium text-gray-700">{t.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {currentType && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              {currentType.fields.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500">{f.label}</label>
                  <input value={fields[f.key] || ''} onChange={e => setFields({ ...fields, [f.key]: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={`请输入${f.label}`} />
                </div>
              ))}
            </div>
          )}

          {err && <div className="text-sm text-red-500">{err}</div>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">取消</button>
            <button onClick={doFulfill} disabled={saving || !type} className="flex-1 rounded-lg bg-green-500 py-2.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50">
              {saving ? '发放中...' : '确认发放'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 发放详情弹窗 ----------
function FulfillDetailModal({ record, onClose }: { record: any; onClose: () => void }) {
  const typeLabel = FULFILLMENT_TYPES.find(t => t.value === record.fulfillmentType)?.label || '其他';
  let info: Record<string, string> = {};
  try { info = record.fulfillmentInfo ? JSON.parse(record.fulfillmentInfo) : {}; } catch {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">发放详情</h3>
        <p className="text-sm text-gray-500 mb-4">{record.item?.name} · {record.user?.nickname}</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">发放方式</span><span className="font-medium">{typeLabel}</span></div>
          {record.fulfilledAt && <div className="flex justify-between"><span className="text-gray-500">发放时间</span><span>{new Date(record.fulfilledAt).toLocaleString('zh-CN')}</span></div>}
          {Object.entries(info).filter(([_, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">{k}</span><span className="text-right break-all">{v}</span></div>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-lg bg-gray-100 py-2.5 text-sm text-gray-700 hover:bg-gray-200">关闭</button>
      </div>
    </div>
  );
}

// ---------- 许愿单审核 ----------
function WishesManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    api.get<{ items: any[] }>('/api/admin/wishes')
      .then(d => setItems(d.items))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    try { await api.patch(`/api/admin/wishes/${id}`, { status }); load(); }
    catch (e: any) { alert(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该许愿?')) return;
    try { await api.del(`/api/admin/wishes/${id}`); load(); }
    catch (e: any) { alert(e.message); }
  };

  const statusBadge = (s: string) => {
    if (s === 'ADOPTED') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">已采纳</span>;
    if (s === 'REVIEWED') return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">已查看</span>;
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600">待查看</span>;
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="许愿单审核" desc="查看用户许愿, 标记已查看或采纳" />
      {err && <div className="text-sm text-red-500">{err}</div>}
      {loading ? <p className="text-sm text-gray-400">加载中…</p> : (
        <div className="space-y-3">
          {items.map(w => (
            <div key={w.id} className="rounded-2xl bg-white shadow-sm p-4">
              <div className="flex gap-3">
                {w.image && <img src={w.image} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{w.itemName}</span>
                    {statusBadge(w.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{w.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <span>{w.user?.nickname}</span>
                    {w.user?.email && <span>· {w.user.email}</span>}
                    <span>· {new Date(w.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {w.status !== 'REVIEWED' && <button onClick={() => setStatus(w.id, 'REVIEWED')} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-500 hover:bg-blue-100">标记已查看</button>}
                {w.status !== 'ADOPTED' && <button onClick={() => setStatus(w.id, 'ADOPTED')} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-600 hover:bg-green-100">采纳</button>}
                {w.status !== 'PENDING' && <button onClick={() => setStatus(w.id, 'PENDING')} className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">重置</button>}
                <button onClick={() => remove(w.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-100 ml-auto">删除</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="rounded-2xl bg-white shadow-sm p-10 text-center text-gray-400">暂无许愿</div>}
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
    case 'avatars': return <AvatarReviewTab />;
    case 'verification': return <VerificationReviewTab isSuper={isSuper} />;
    case 'qualifications': return <QualificationReviewTab isSuper={isSuper} />;
    case 'template': return <TemplateManager />;
    case 'appeals': return <BanAppealsTab />;
    case 'notifications': return <NotificationSender />;
    case 'settings': return <SiteSettings />;
    case 'email': return <EmailSettings />;
    case 'agreement': return <AgreementManager />;
    case 'roles': return <RolesManager />;
    case 'badges': return <BadgesManager />;
    case 'schools': return <SchoolsManager />;
    case 'orgs': return <OrgsManager />;
    case 'quicklinks': return <QuickLinksManager />;
    case 'shop': return <ShopManager />;
    case 'wishes': return <WishesManager />;
    default: return <OverviewTab />;
  }
}
