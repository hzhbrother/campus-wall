'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';
import { usePageRefresh } from '@/lib/use-page-refresh';
import type { AdminTab } from '@/components/admin/AdminPanel';

// 管理后台懒加载 (大幅减少首屏体积)
const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel').then(m => m.AdminPanel), {
  ssr: false,
  loading: () => <div className="py-12 text-center text-gray-400">加载中…</div>,
});

type View = 'home' | 'admin' | 'edit' | AdminTab;

// ---------- 通用行组件 (定义在组件外, 避免每次渲染重建导致 input 失焦) ----------
const Row = ({ label, children, onClick, border = true }: { label: React.ReactNode; children: React.ReactNode; onClick?: () => void; border?: boolean }) => (
  <div className={`flex items-center justify-between px-1 py-3.5 ${border ? 'border-b border-gray-100' : ''} ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`} onClick={onClick}>
    <span className="text-[15px] text-gray-800">{label}</span>
    <div className="flex items-center gap-1">{children}</div>
  </div>
);

const Arrow = () => (
  <svg className="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

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
  // 邮箱绑定验证码
  const [emailCode, setEmailCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 邮箱是否被修改 (与原值不同)
  const emailChanged = (email.trim() || '') !== (user?.email || '');

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const classOptions = grade ? CLASS_LIST : [];

  // 发送邮箱绑定验证码
  const sendEmailBindCode = async () => {
    if (!email.trim()) { setMsg('请先输入邮箱'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg('邮箱格式不正确'); return; }
    setSendingCode(true); setMsg('');
    try {
      await api.post('/api/users/me/email/send-code', { email: email.trim() });
      setCodeSent(true);
      setCountdown(60);
      setMsg('验证码已发送, 请查收邮件');
    } catch (e: any) { setMsg(e.message); }
    finally { setSendingCode(false); }
  };

  const save = async () => {
    setMsg(''); setPhoneError('');
    if (!realName.trim()) { setMsg('请输入真实姓名'); return; }

    const hasPhone = phoneNumber.trim().length > 0;
    const hasEmail = email.trim().length > 0;

    // 邮箱必填
    if (!hasEmail) { setMsg('请输入邮箱'); return; }
    // 校验邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg('邮箱格式不正确'); return; }
    // 校验手机号格式 (选填, 填写了才校验)
    if (hasPhone) {
      const v = validatePhone(countryCode, phoneNumber);
      if (!v.ok) { setPhoneError(v.message || '请输入手机号'); return; }
    }
    // 邮箱变更时必须验证
    if (emailChanged && !emailCode.trim()) {
      setMsg('邮箱已变更, 请输入验证码完成绑定');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nickname, realName: realName.trim(),
        countryCode: hasPhone ? countryCode : '',
        phoneNumber: hasPhone ? phoneNumber : '',
        email: email.trim(),
        grade, className, remark, avatar,
      };
      if (emailChanged) payload.emailCode = emailCode.trim();
      await api.patch('/api/users/me', payload);
      setMsg('已保存');
      setEmailCode(''); setCodeSent(false);
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const country = getCountryByCode(countryCode);

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
        <p className="mt-3 text-xs text-orange-500">为保障账号安全, 请先完善真实姓名和邮箱 (邮箱为必填)</p>
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

      {/* 邮箱 - 必填, 变更需验证 */}
      <div className="border-b border-gray-100 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-gray-800">邮箱<span className="ml-1 text-red-500">*</span><span className="ml-1 text-xs text-gray-400">(用于找回密码/通知)</span></span>
          <div className="flex items-center gap-2">
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailCode(''); setCodeSent(false); }} className="w-40 text-right text-[15px] text-gray-900 outline-none" placeholder="请输入邮箱" />
          </div>
        </div>
        {emailChanged && (
          <div className="mt-3 flex items-center gap-2">
            <input type="text" inputMode="numeric" maxLength={6} value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))} className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[15px] outline-none focus:border-blue-400" placeholder="请输入验证码" />
            <button type="button" onClick={sendEmailBindCode} disabled={sendingCode || countdown > 0} className="shrink-0 rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
              {sendingCode ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : codeSent ? '重新发送' : '获取验证码'}
            </button>
          </div>
        )}
      </div>

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

      <p className="mb-1 text-xs text-gray-400">邮箱为必填项, 变更邮箱需短信验证码验证; 手机号选填</p>

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
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [profileBg, setProfileBg] = useState('');

  // 系统管理员/超级管理员, 或拥有自定义角色的用户均可进入管理后台
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || !!user?.roleId;
  const isSuper = user?.role === 'SUPER_ADMIN';
  const forcePhone = searchParams.get('forcePhone') === '1';

  // 加载个人中心背景图 (管理员可在站点设置中配置)
  useEffect(() => {
    api.get<{ profile_bg?: string }>('/api/site-config')
      .then(d => { if (d.profile_bg) setProfileBg(d.profile_bg); })
      .catch(() => {});
  }, []);

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

  // 标签页激活时刷新用户信息 (跳过挂载时首次刷新, 由 auth context 负责)
  usePageRefresh(() => { refreshUser(); }, [refreshUser], true);

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
      { key: 'verification', label: '实名认证审核' },
      { key: 'appeals', label: '申诉审核' },
      { key: 'notifications', label: '通知发布' },
      // 站点配置类 (SMTP/站点信息/协议) + 角色管理 + 识别模板 仅超级管理员可见
      ...(isSuper ? [
        { key: 'roles' as AdminTab, label: '角色管理' },
        { key: 'template' as AdminTab, label: '识别模板' },
        { key: 'email' as AdminTab, label: '邮件配置' },
        { key: 'settings' as AdminTab, label: '站点设置' },
        { key: 'agreement' as AdminTab, label: '协议管理' },
      ] : []),
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
  const verifyMenuLabel = user?.role === 'ADMIN' ? '资质认证' : user?.role === 'SUPER_ADMIN' ? '资质认证' : '实名认证';
  const menuItems = [
    { key: 'homepage', label: '我的主页', icon: '🏠' },
    { key: 'favorites', label: '我的收藏', icon: '⭐' },
    { key: 'verification', label: verifyMenuLabel, icon: '✅' },
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
    if (key === 'verification') { setShowVerifyModal(true); return; }
    if (key === 'agreement') { router.push('/agreement'); return; }
    if (key === 'privacy') { router.push('/privacy'); return; }
    if (key === 'about') { router.push('/about'); return; }
    alert(`「${menuItems.find(m => m.key === key)?.label}」功能开发中…`);
  };

  return (
    <div className="space-y-4">
      {/* 渐变头部 (管理员可配置背景图) */}
      <div className="-mx-4 -mt-3 px-4 pt-6 pb-12 relative overflow-hidden"
        style={profileBg ? { backgroundImage: `url(${profileBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {/* 无背景图时用渐变兜底 */}
        {!profileBg && <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400" />}
        {/* 半透明遮罩, 保证文字可读 */}
        {profileBg && <div className="absolute inset-0 bg-black/30" />}
        <div className="relative flex items-center gap-4">
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
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white">{user.nickname}</span>
                  {user.verified ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/25 px-1.5 py-0.5 text-xs text-white">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      已认证
                    </span>
                  ) : user.verificationStatus === 'PENDING' ? (
                    <span className="rounded-full bg-amber-400/90 px-1.5 py-0.5 text-xs text-white">审核中</span>
                  ) : null}
                  {user.qualificationVerified && user.qualificationType && (
                    <span className="rounded-full bg-purple-400/80 px-1.5 py-0.5 text-xs text-white">🏅 {user.qualificationType}</span>
                  )}
                </div>
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

      {/* 菜单宫格 */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="grid grid-cols-4 gap-1">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleMenu(item.key)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-gray-600 text-center leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
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

      {/* 实名认证弹窗 */}
      {showVerifyModal && user && (
        <VerificationModal
          user={user}
          onClose={() => setShowVerifyModal(false)}
          onVerified={() => { refreshUser(); setShowVerifyModal(false); }}
          onSubmitted={() => refreshUser()}
        />
      )}
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

// ---------- 实名认证 / 资质认证弹窗 ----------
function VerificationModal({ user, onClose, onVerified, onSubmitted }: { user: any; onClose: () => void; onVerified: () => void; onSubmitted?: () => void }) {
  const [photo, setPhoto] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // 本地认证状态 (提交后用于实时展示进度, 轮询刷新)
  const [localStatus, setLocalStatus] = useState<string>(user.verificationStatus || 'NONE');
  const [localRejectReason, setLocalRejectReason] = useState<string>(user.verificationRejectReason || '');

  // 加载学校列表
  useEffect(() => {
    api.get<{ templates: { id: string; name: string }[] }>('/api/verification-templates')
      .then(d => setSchools(d.templates || []))
      .catch(() => {});
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const d = await api.get<{ verificationStatus: string; verificationRejectReason?: string; verified?: boolean }>('/api/users/me/verification');
      setLocalStatus(d.verificationStatus || 'NONE');
      setLocalRejectReason(d.verificationRejectReason || '');
      if (d.verified || d.verificationStatus === 'APPROVED') onVerified();
    } catch { /* ignore */ }
  }, [onVerified]);

  const role = user.role || 'STUDENT';
  // 认证类型: 学生/教师走实名认证(校园卡), 管理员走资质认证(证明材料), 超级管理员自动已认证
  const isQualification = role === 'ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const verifyLabel = isQualification ? '资质认证' : '实名认证';
  const photoLabel = isQualification ? '证明材料' : '校园卡';
  const photoDesc = isQualification
    ? '请拍摄能证明您管理员身份的材料'
    : '请拍摄清晰的校园卡照片';

  const status = localStatus || user.verificationStatus || 'NONE';
  const isApproved = user.verified || status === 'APPROVED';
  const isAiReviewing = status === 'AI_REVIEWING';
  const isPending = status === 'PENDING';
  const isRejected = status === 'REJECTED';
  const inProgress = isAiReviewing || isPending;

  // AI 初审 / 人工复核期间轮询刷新状态 (每 3 秒)
  useEffect(() => {
    if (!isAiReviewing && !isPending) return;
    const t = setInterval(refreshStatus, 3000);
    return () => clearInterval(t);
  }, [isAiReviewing, isPending, refreshStatus]);

  // 认证进度阶段: 0=提交, 1=AI初审, 2=人工复核, 3=完成
  const progressStep = isApproved ? 3 : isPending ? 2 : isAiReviewing ? 1 : (status !== 'NONE' ? 0 : -1);

  // 压缩图片至最大边 1280px
  const compress = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('加载失败'));
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round(height * (MAX / width)); width = MAX; }
          else { width = Math.round(width * (MAX / height)); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

  const onCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg('');
    try {
      const dataUrl = await compress(file);
      setPhoto(dataUrl);
    } catch {
      setMsg('图片处理失败, 请重试');
    }
    e.target.value = '';
  };

  const submit = async () => {
    if (!templateId) { setMsg('请先选择学校'); return; }
    if (!photo) { setMsg('请先拍摄校园卡照片'); return; }
    setBusy(true); setMsg('');
    try {
      const res: any = await api.post('/api/users/me/verification', { photo, templateId });
      setMsg(res?.message || '认证申请已提交');
      // 刷新弹窗内进度 + 刷新整个资料页 (父页面实名认证状态同步更新)
      await refreshStatus();
      onSubmitted?.();
      setPhoto('');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{verifyLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* 超级管理员: 自动已认证 */}
        {isSuperAdmin ? (
          <div className="rounded-xl bg-green-50 p-4 text-center">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-sm font-medium text-green-700">已认证</div>
            <div className="text-xs text-green-600 mt-1">超级管理员身份自动通过认证</div>
          </div>
        ) : isApproved ? (
          <div className="rounded-xl bg-green-50 p-4 text-center">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-sm font-medium text-green-700">已{verifyLabel}</div>
            {user.verifiedAt && <div className="text-xs text-green-600 mt-1">认证时间: {new Date(user.verifiedAt).toLocaleDateString('zh-CN')}</div>}
          </div>
        ) : inProgress ? (
          <div className="rounded-xl bg-amber-50 p-4">
            {/* 进度条 */}
            <div className="relative flex items-center justify-between px-1 mb-3">
              {/* 背景连接线 */}
              <div className="absolute left-4 right-4 top-3.5 h-0.5 bg-gray-200" />
              <div className={`absolute left-4 top-3.5 h-0.5 bg-amber-400 transition-all`} style={{ width: `calc(${(progressStep / 3) * 100}% - 1rem)` }} />
              {[
                { step: 0, label: '提交申请' },
                { step: 1, label: 'AI 初审' },
                { step: 2, label: '人工复核' },
                { step: 3, label: '认证完成' },
              ].map(s => {
                const reached = progressStep >= s.step;
                const current = progressStep === s.step;
                return (
                  <div key={s.step} className="relative z-10 flex flex-col items-center">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      reached ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-400'
                    } ${current ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}>
                      {reached && s.step === 3 ? '✓' : s.step + 1}
                    </div>
                    <div className={`mt-1 text-[10px] whitespace-nowrap ${reached ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-2">
              {isAiReviewing ? (
                <>
                  <div className="text-sm font-medium text-amber-700">🤖 AI 初审中</div>
                  <div className="text-xs text-amber-600 mt-1">正在识别您的{photoLabel}, 请稍候…</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-amber-700">⏳ 等待人工复核</div>
                  <div className="text-xs text-amber-600 mt-1">AI 初审已通过, 管理员正在复核您的{verifyLabel}申请</div>
                </>
              )}
            </div>
          </div>
        ) : isRejected ? (
          <div className="rounded-xl bg-red-50 p-4 mb-3">
            <div className="text-sm font-medium text-red-700">❌ 认证被驳回</div>
            {user.verificationRejectReason || localRejectReason ? (
              <div className="text-xs text-red-600 mt-1">原因: {user.verificationRejectReason || localRejectReason}</div>
            ) : null}
            <div className="text-xs text-red-500 mt-1">请重新拍摄清晰的{photoLabel}照片后再次提交</div>
          </div>
        ) : null}

        {/* 未通过且非审核中时可提交 */}
        {!isSuperAdmin && !isApproved && !isPending && !isAiReviewing && (
          <>
            <div className="rounded-xl bg-blue-50 p-3 mb-3">
              <div className="text-sm font-medium text-blue-800 mb-1">拍摄要求</div>
              <p className="text-xs text-blue-700">{photoDesc}</p>
            </div>

            {/* 学校选择 */}
            {!isQualification && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">选择学校</label>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">请选择学校</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {photo ? (
              <div className="relative mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={photoLabel} className="w-full rounded-xl border border-gray-200" />
                <button onClick={() => setPhoto('')} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white text-sm">✕</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-gray-300 py-8 mb-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                <svg className="h-10 w-10 text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span className="text-sm text-blue-600 font-medium">点击拍摄{photoLabel}</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onCapture}
                />
              </label>
            )}

            {msg && <p className={`mb-3 text-sm ${msg.includes('已提交') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}

            <button onClick={submit} disabled={busy || !photo || (!isQualification && !templateId)} className="w-full rounded-full bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? '提交中…' : '提交认证申请'}
            </button>
          </>
        )}

        {(isPending || isAiReviewing) && (
          <p className="mt-3 text-center text-xs text-gray-400">审核期间无法重复提交, 请等待结果</p>
        )}
      </div>
    </div>
  );
}
