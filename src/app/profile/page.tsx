'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';
import type { AdminTab } from '@/components/admin/AdminPanel';

// 管理后台懒加载 (大幅减少首屏体积)
const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel').then(m => m.AdminPanel), {
  ssr: false,
  loading: () => <div className="py-12 text-center text-gray-400">加载中…</div>,
});

type View = 'home' | 'admin' | 'edit' | AdminTab;

// ---------- 个人资料编辑 ----------
const GRADES = ['高一', '高二', '高三', '初一', '初二', '初三'];
const CLASS_LIST = ['1班', '2班', '3班', '4班', '5班', '6班', '7班', '8班', '9班', '10班'];

function EditProfile({ user, onSaved, forcePhone = false }: { user: any; onSaved: () => void; forcePhone?: boolean }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [realName, setRealName] = useState(user?.realName || '');
  const [countryCode, setCountryCode] = useState(user?.countryCode || '+86');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [email, setEmail] = useState(user?.email || '');
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
    if (!realName.trim()) { setMsg('请输入真实姓名'); return; }

    const hasPhone = phoneNumber.trim().length > 0;
    const hasEmail = email.trim().length > 0;

    // 手机号和邮箱至少填一个
    if (!hasPhone && !hasEmail) {
      setMsg('手机号和邮箱至少填写一个');
      return;
    }
    // 校验手机号格式 (如果填写了)
    if (hasPhone) {
      const v = validatePhone(countryCode, phoneNumber);
      if (!v.ok) { setPhoneError(v.message || '请输入手机号'); return; }
    }
    // 校验邮箱格式 (如果填写了)
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg('邮箱格式不正确');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/api/users/me', {
        nickname, realName: realName.trim(), countryCode: hasPhone ? countryCode : '',
        phoneNumber: hasPhone ? phoneNumber : '',
        email: hasEmail ? email.trim() : '',
        grade, className, remark, avatar,
      });
      setMsg('已保存');
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const country = getCountryByCode(countryCode);

  const Row = ({ label, children, onClick, border = true }: { label: React.ReactNode; children: React.ReactNode; onClick?: () => void; border?: boolean }) => (
    <div className={`flex items-center justify-between px-1 py-3.5 ${border ? 'border-b border-gray-100' : ''} ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`} onClick={onClick}>
      <span className="text-[15px] text-gray-800">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );

  const Arrow = () => (
    <svg className="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );

  return (
    <div>
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

      {forcePhone && (
        <p className="mt-3 text-xs text-orange-500">为保障账号安全, 请先完善真实姓名和联系方式 (手机号或邮箱)</p>
      )}

      <Row label="昵称">
        <input value={nickname} onChange={e => setNickname(e.target.value)} className="w-32 text-right text-[15px] text-gray-900 outline-none" placeholder="请输入昵称" />
      </Row>

      {/* 手机号 - 选填 */}
      <div className="border-b border-gray-100 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-gray-800">手机号<span className="ml-1 text-xs text-gray-400">(选填)</span></span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowCountryPicker(true)} className="flex items-center gap-0.5 text-[15px] text-gray-900">
              {country.code}
              <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <input type="tel" inputMode="numeric" value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value.replace(/\D/g, '')); setPhoneError(''); }} className="w-28 text-right text-[15px] text-gray-900 outline-none" placeholder="请输入手机号" maxLength={Math.max(...country.lengths)} />
          </div>
        </div>
        {phoneError && <p className="mt-1 text-right text-xs text-red-500">{phoneError}</p>}
      </div>

      {/* 邮箱 - 选填 */}
      <Row label={<>邮箱<span className="ml-1 text-xs text-gray-400">(选填, 用于找回密码)</span></>}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-44 text-right text-[15px] text-gray-900 outline-none" placeholder="请输入邮箱" />
      </Row>

      <Row label={<>真实姓名<span className="ml-1 text-red-500">*</span></>}>
        <input value={realName} onChange={e => setRealName(e.target.value)} className="w-32 text-right text-[15px] text-gray-900 outline-none" placeholder="请输入真实姓名" />
      </Row>

      <Row label="年级" onClick={() => setEditingField(editingField === 'grade' ? null : 'grade')}>
        <span className={`text-[15px] ${grade ? 'text-gray-900' : 'text-gray-400'}`}>{grade || '不填写'}</span>
        <Arrow />
      </Row>
      {editingField === 'grade' && (
        <div className="px-1 py-2 border-b border-gray-100">
          <select value={grade} onChange={e => { setGrade(e.target.value); setClassName(''); setEditingField(null); }} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <option value="">不填写</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      )}

      <Row label="班级" onClick={() => grade && setEditingField(editingField === 'class' ? null : 'class')}>
        <span className={`text-[15px] ${className ? 'text-gray-900' : 'text-gray-400'}`}>{className || (grade ? '请选择' : '不填写')}</span>
        {grade && <Arrow />}
      </Row>
      {editingField === 'class' && grade && (
        <div className="px-1 py-2 border-b border-gray-100">
          <select value={className} onChange={e => { setClassName(e.target.value); setEditingField(null); }} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <option value="">不填写</option>
            {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      <div className="py-3.5">
        <div className="mb-2 text-[15px] text-gray-800">个人简介</div>
        <textarea value={remark} onChange={e => setRemark(e.target.value.slice(0, 200))} rows={3} className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="介绍一下自己吧..." />
        <div className="mt-1 text-right text-xs text-gray-400">{remark.length}/200</div>
      </div>

      <p className="mb-1 text-xs text-gray-400">手机号和邮箱至少填写一个</p>

      {msg && <p className={`text-sm ${msg.includes('成功') || msg.includes('已保存') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}

      <button onClick={save} disabled={saving} className="mt-2 w-full rounded-full bg-blue-500 py-3.5 text-[15px] font-medium text-white hover:bg-blue-600 disabled:opacity-50">
        {saving ? '保存中…' : '保存'}
      </button>

      {!forcePhone && (
        <button onClick={() => { if (confirm('确定退出登录吗？')) { logout(); router.push('/'); } }} className="mt-3 w-full rounded-full border border-red-400 py-3.5 text-[15px] font-medium text-red-500 hover:bg-red-50">
          退出登录
        </button>
      )}

      {showCountryPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowCountryPicker(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <h3 className="mb-4 text-center text-lg font-bold text-slate-900">选择国家/地区</h3>
            <div className="space-y-1">
              {COUNTRY_CODES.map(c => (
                <button key={c.code} onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); setPhoneError(''); }} className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left ${c.code === countryCode ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}>
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
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuper = user?.role === 'SUPER_ADMIN';
  const forcePhone = searchParams.get('forcePhone') === '1';

  useEffect(() => {
    if (searchParams.get('edit') === '1' && view === 'home') {
      setView('edit');
    }
    // 通过通知链接直接打开管理后台的申诉审核
    const tab = searchParams.get('tab');
    if (tab === 'appeals' && view !== 'appeals') {
      setAdminTab('appeals');
      setView('appeals');
    }
  }, [searchParams, view]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>;

  const counts = (user as any)?._count || { posts: 0, comments: 0, likes: 0 };

  // ---- 管理后台视图 ----
  if (view !== 'home' && view !== 'edit') {
    const adminTabs: { key: AdminTab; label: string }[] = [
      { key: 'overview', label: '数据概览' },
      { key: 'posts', label: '帖子管理' },
      { key: 'moderation', label: '内容审核' },
      { key: 'comments', label: '评论管理' },
      { key: 'users', label: '用户管理' },
      { key: 'appeals', label: '申诉审核' },
      { key: 'notifications', label: '通知发布' },
      { key: 'email', label: '邮件配置' },
      { key: 'settings', label: '站点设置' },
      { key: 'agreement', label: '协议管理' },
    ];
    const tab = view === 'admin' ? adminTab : (view as AdminTab);
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>
        {/* 移动端: 顶部横向标签; 桌面端: 左侧侧边栏 */}
        <div className="flex flex-col md:flex-row md:gap-5">
          {/* 侧边栏 (桌面端) / 横向标签 (移动端) */}
          <div className="flex flex-row md:flex-col gap-2 md:w-40 md:shrink-0 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {adminTabs.map(t => (
              <button key={t.key} onClick={() => { setAdminTab(t.key); setView(t.key); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm md:rounded-lg md:text-left ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {/* 内容区 */}
          <div className="flex-1 min-w-0 rounded-2xl bg-white p-5 shadow-sm">
            <AdminPanel tab={tab} isSuper={isSuper} />
          </div>
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
          <EditProfile user={user} forcePhone={forcePhone} onSaved={() => { refreshUser?.(); if (!forcePhone) setView('home'); else router.push('/'); }} />
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
    { key: 'violations', label: '违规记录', icon: '📋' },
    { key: 'ban-appeal', label: '封禁申诉', icon: '✊' },
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
            { label: '获赞', value: counts.likesReceived || 0, color: 'text-red-500' },
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
        <button onClick={() => { logout(); router.push('/'); }} className="w-full rounded-2xl bg-white py-3.5 text-sm text-red-500 shadow-sm hover:bg-gray-50">
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
