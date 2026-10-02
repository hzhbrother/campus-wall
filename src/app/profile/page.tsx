'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';
import { usePageRefresh } from '@/lib/use-page-refresh';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BadgesView } from '@/components/BadgesView';
import { CheckInView } from '@/components/CheckInView';
import { WishView } from '@/components/WishView';
import { JoinOrgModal } from '@/components/JoinOrgModal';
import { formatUserCode } from '@/lib/user-number';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import { JUHE_TYPES } from '@/lib/aggregated-login';
import type { AdminTab } from '@/components/admin/AdminPanel';

// 管理后台懒加载 (大幅减少首屏体积)
const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel').then(m => m.AdminPanel), {
  ssr: false,
  loading: () => <div className="py-12 text-center text-gray-400">加载中…</div>,
});

type View = 'home' | 'admin' | 'edit' | 'security' | 'violations' | 'my-badges' | 'checkin' | 'wish' | 'contact' | 'account-switch' | AdminTab;

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

// ---------- 第三方账号绑定卡片 ----------
function AccountBindingsCard({ userId }: { userId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ accounts: any[] }>('/api/users/me/accounts')
      .then(d => setAccounts(d.accounts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBind = (type: string) => {
    // 跳转到聚合登录绑定模式
    window.location.href = `/api/auth/oauth/aggregated/${type}?bind=1`;
  };

  const handleUnbind = async (provider: string) => {
    if (!confirm(`确定解绑 ${provider} 账号吗?`)) return;
    setBusy(provider);
    try {
      await api.del(`/api/users/me/accounts/${provider}`);
      load();
    } catch (e: any) {
      alert(e?.message || '解绑失败');
    } finally { setBusy(null); }
  };

  const isBound = (provider: string) => accounts.some(a => a.provider === provider);

  if (loading) return <div className="rounded-2xl bg-white shadow-sm p-4 text-sm text-gray-400">加载中…</div>;

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 mb-3">第三方账号绑定</h3>
      <div className="space-y-2">
        {JUHE_TYPES.map(t => (
          <div key={t.type} className="flex items-center gap-3 py-2">
            <span className="text-xl">{t.icon}</span>
            <span className="flex-1 text-sm text-gray-800">{t.label}</span>
            {isBound(t.provider) ? (
              <button
                onClick={() => handleUnbind(t.provider)}
                disabled={busy === t.provider}
                className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-500 hover:bg-red-100 disabled:opacity-50"
              >
                {busy === t.provider ? '解绑中…' : '解绑'}
              </button>
            ) : (
              <button
                onClick={() => handleBind(t.type)}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-500 hover:bg-blue-100"
              >
                绑定
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 个人资料编辑 ----------
function EditProfile({ user, onSaved, forcePhone = false, refreshUser }: { user: any; onSaved: () => void; forcePhone?: boolean; refreshUser?: () => void }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [realName, setRealName] = useState(user?.realName || '');
  const [countryCode, setCountryCode] = useState(user?.countryCode || '+86');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [email, setEmail] = useState(user?.email || '');
  const [remark, setRemark] = useState(user?.remark || '');
  const [avatarDraft, setAvatarDraft] = useState<string>(''); // 本地预览的新头像, 保存时才上传
  const [avatarCompressing, setAvatarCompressing] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [schoolId, setSchoolId] = useState(user?.school?.id || '');
  const [organizationId, setOrganizationId] = useState(user?.organization?.id || '');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
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

  // 加载学校和团体列表
  useEffect(() => {
    api.get<{ items: { id: string; name: string }[] }>('/api/schools').then(d => setSchools(d.items || [])).catch(() => {});
    api.get<{ items: { id: string; name: string }[] }>('/api/orgs').then(d => setOrganizations(d.items || [])).catch(() => {});
  }, []);

  // 头像选择: 只压缩并本地预览, 不立即上传 (点"保存"时随资料一起提交)
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarCompressing(true);
    setAvatarMsg('');
    try {
      const compressed = await compressImage(file, 256, 0.8);
      setAvatarDraft(compressed);
      setAvatarMsg('已选择, 点击下方"保存"提交审核');
    } catch {
      setAvatarMsg('图片处理失败');
    } finally {
      setAvatarCompressing(false);
      e.target.value = '';
    }
  };

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
    const isVerified = user?.verified || user?.verificationStatus === 'APPROVED';
    if (!isVerified && !realName.trim()) { setMsg('请输入真实姓名'); return; }

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
      const isVerified = user?.verified || user?.verificationStatus === 'APPROVED';
      const payload: any = {
        nickname,
        // 已认证用户真实姓名锁定, 不提交
        ...(isVerified ? {} : { realName: realName.trim() }),
        countryCode: hasPhone ? countryCode : '',
        phoneNumber: hasPhone ? phoneNumber : '',
        email: email.trim(),
        remark,
        schoolId, organizationId,
      };
      if (emailChanged) payload.emailCode = emailCode.trim();
      // 头像: 如果有本地预览的新头像, 一并提交 (走审核流程)
      if (avatarDraft) payload.avatar = avatarDraft;
      await api.patch('/api/users/me', payload);
      await refreshUser?.();
      setAvatarDraft('');
      setAvatarMsg('头像已提交, 等待审核');
      setMsg('已保存');
      setEmailCode(''); setCodeSent(false);
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  };

  const country = getCountryByCode(countryCode);

  // 头像展示: 优先显示本地预览的新头像 (avatarDraft), 其次待审核头像, 最后已通过的头像
  const displayAvatar = avatarDraft || user?.pendingAvatar || user?.avatar || '';
  const avatarStatus = user?.avatarStatus;
  const isAvatarPending = avatarStatus === 'PENDING' && !avatarDraft;
  const isAvatarRejected = avatarStatus === 'REJECTED' && !avatarDraft;

  return (
    <div>
      <div className="py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-gray-800">头像</span>
          <div className="relative">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
              {displayAvatar ? <img src={displayAvatar} alt="" className="h-full w-full object-cover" /> : (nickname[0] || 'U').toUpperCase()}
            </div>
            {/* 头像审核状态: PENDING 橙色小圆点 + "审核中"; REJECTED 红色 "!" */}
            {isAvatarPending && (
              <span className="absolute -top-1 -right-1 flex items-center gap-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                审核中
              </span>
            )}
            {isAvatarRejected && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow">!</span>
            )}
            <label className={`absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-blue-500 p-1 text-white shadow ${avatarCompressing ? 'opacity-50' : ''}`}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} disabled={avatarCompressing} />
            </label>
          </div>
        </div>
        {/* 头像审核说明 / 状态提示 */}
        <div className="mt-2 text-xs text-gray-400">头像更换需审核, 1-2 个工作日内完成, 上学期间 5-7 个工作日</div>
        {avatarMsg && <p className={`mt-1 text-xs ${avatarMsg.includes('已提交') || avatarMsg.includes('已选择') ? 'text-green-600' : 'text-red-500'}`}>{avatarMsg}</p>}
        {avatarCompressing && <p className="mt-1 text-xs text-gray-400">图片处理中…</p>}
        {isAvatarRejected && user?.avatarRejectReason && (
          <p className="mt-1 text-xs text-red-500">上次驳回原因: {user.avatarRejectReason}</p>
        )}
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

      <Row label={<>真实姓名{user?.verified || user?.verificationStatus === 'APPROVED' ? <span className="ml-1 text-green-500 text-xs">✓已认证</span> : <span className="ml-1 text-red-500">*</span>}</>}>
        {user?.verified || user?.verificationStatus === 'APPROVED' ? (
          <span className="text-[15px] text-gray-900">{realName || '-'}</span>
        ) : (
          <input value={realName} onChange={e => setRealName(e.target.value)} className="w-32 text-right text-[15px] text-gray-900 outline-none" placeholder="请输入真实姓名" />
        )}
      </Row>

      {/* 所属学校 / 团体 (互斥) */}
      <Row label="所属学校" onClick={() => setEditingField(editingField === 'school' ? null : 'school')}>
        <span className={`text-[15px] ${schoolId ? 'text-gray-900' : 'text-gray-400'}`}>
          {schools.find(s => s.id === schoolId)?.name || '不选择'}
        </span>
        <Arrow />
      </Row>
      {editingField === 'school' && (
        <div className="px-1 py-2 border-b border-gray-100">
          <select
            value={schoolId}
            onChange={e => { const v = e.target.value; setSchoolId(v); if (v) setOrganizationId(''); setEditingField(null); }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            <option value="">不选择</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <Row label="所属团体" onClick={() => setEditingField(editingField === 'org' ? null : 'org')}>
        <span className={`text-[15px] ${organizationId ? 'text-gray-900' : 'text-gray-400'}`}>
          {organizations.find(o => o.id === organizationId)?.name || '不选择'}
        </span>
        <Arrow />
      </Row>
      {editingField === 'org' && (
        <div className="px-1 py-2 border-b border-gray-100">
          <select
            value={organizationId}
            onChange={e => { const v = e.target.value; setOrganizationId(v); if (v) setSchoolId(''); setEditingField(null); }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          >
            <option value="">不选择</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
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

      <div className="flex gap-3 mt-2">
        <button onClick={() => onSaved()} className="flex-1 rounded-full border border-gray-300 py-3.5 text-[15px] font-medium text-gray-600 hover:bg-gray-50">
          取消
        </button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-full bg-blue-500 py-3.5 text-[15px] font-medium text-white hover:bg-blue-600 disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>

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
  const { user, loading, logout, refreshUser, savedAccounts, switchAccount, removeSavedAccount, maxAccounts } = useAuth();
  const [view, setView] = useState<View>('home');
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showJoinOrg, setShowJoinOrg] = useState(false);
  const [joinOrgDismissed, setJoinOrgDismissed] = useState(false);

  // 未认证每日提醒 (localStorage 存上次提醒日期)
  const [showAuthReminder, setShowAuthReminder] = useState(false);
  const [verifyModalInitial, setVerifyModalInitial] = useState<'IDENTITY' | 'QUALIFICATION' | null>(null);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [profileBg, setProfileBg] = useState('');

  // 系统管理员/超级管理员, 或拥有自定义角色的用户均可进入管理后台
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || !!user?.roleId;
  const isSuper = user?.role === 'SUPER_ADMIN';
  const forcePhone = searchParams.get('forcePhone') === '1';

  // 判断当前用户是否拥有某权限 (前端标签可见性用, 真正的权限校验在后端)
  const hasPerm = useCallback((code: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.customRole?.permissions) return user.customRole.permissions.includes(code);
    return (DEFAULT_ROLE_PERMISSIONS[user.role] || []).includes(code);
  }, [user]);

  // 加载个人中心背景图 (管理员可在站点设置中配置)
  useEffect(() => {
    api.get<{ profile_bg?: string }>('/api/site-config')
      .then(d => { if (d.profile_bg) setProfileBg(d.profile_bg); })
      .catch(() => {});
  }, []);

  // 新用户未加入学校/团体时, 弹出加入引导 (仅弹一次, 跳过不再显示)
  useEffect(() => {
    if (loading || !user) return;
    if (!user.schoolId && !user.organizationId && !joinOrgDismissed) {
      setShowJoinOrg(true);
    }
  }, [loading, user, joinOrgDismissed]);

  // 未认证每日提醒: 每天首次进入「我的」页面时弹一次
  useEffect(() => {
    if (loading || !user) return;
    const isVerified = user.verificationStatus === 'APPROVED' || !!user.verified;
    if (isVerified) return; // 已认证不弹
    // 今天已提醒过 → 跳过
    const today = new Date().toISOString().slice(0, 10);
    const lastReminded = localStorage.getItem('auth_reminder_date');
    if (lastReminded === today) return;
    // 注册后不足 3 天不打扰
    const created = user.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const daysSinceReg = (Date.now() - created) / 86400000;
    if (daysSinceReg < 1) return;
    setShowAuthReminder(true);
  }, [loading, user]);

  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setView('edit');
      // 消费后清除 URL 参数, 避免返回时 useEffect 重新触发导致死循环
      router.replace('/profile', { scroll: false });
      return;
    }
    // 通过通知链接直接打开管理后台的申诉审核
    const tab = searchParams.get('tab');
    if (tab === 'appeals' || tab === 'verification' || tab === 'qualifications' || tab === 'moderation' || tab === 'users') {
      setAdminTab(tab);
      setView(tab);
      router.replace('/profile', { scroll: false });
    }
  }, [searchParams]);

  // 标签页激活时刷新用户信息 (跳过挂载时首次刷新, 由 auth context 负责)
  usePageRefresh(() => { refreshUser(); }, [refreshUser], true);

  // 切换视图时自动刷新用户数据, 保证每个界面信息最新
  // (子组件 BadgesView/CheckInView 重挂载时自带数据获取; 封面上传弹窗有 modalOpenRef 保护)
  useEffect(() => {
    if (loading || !user) return;
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>;
  if (!user) { router.push('/login'); return null; }

  const counts = (user as any)?._count || { posts: 0, comments: 0, likes: 0, favorites: 0, likesReceived: 0 };

  // 判断是否为管理后台标签
  const ADMIN_TABS: AdminTab[] = ['overview', 'posts', 'moderation', 'comments', 'users', 'avatars', 'verification', 'qualifications', 'template', 'appeals', 'notifications', 'settings', 'email', 'agreement', 'roles', 'badges', 'schools', 'orgs', 'quicklinks', 'shop', 'wishes'];
  const isAdminView = (v: View): v is AdminTab => ADMIN_TABS.includes(v as AdminTab);

  // ---- 管理后台视图 ----
  if (isAdminView(view)) {
    // 标签可见性: 基于权限 (超管全权限; 自定义角色按 customRole.permissions; 系统角色按默认权限)
    const allTabs: { key: AdminTab; label: string; perm?: string }[] = [
      { key: 'overview', label: '数据概览' },
      { key: 'posts', label: '帖子管理', perm: 'post.view' },
      { key: 'moderation', label: '内容审核', perm: 'post.moderate' },
      { key: 'comments', label: '评论管理', perm: 'comment.view' },
      { key: 'users', label: '用户管理', perm: 'user.view' },
      { key: 'avatars', label: '头像审核', perm: 'user.view' },
      { key: 'verification', label: '实名认证审核', perm: 'verification.review' },
      { key: 'qualifications', label: '资质/荣誉审核', perm: 'qualification.review' },
      { key: 'appeals', label: '申诉审核', perm: 'appeal.view' },
      { key: 'notifications', label: '通知发布', perm: 'notification.send' },
      { key: 'schools', label: '学校管理', perm: 'school.manage' },
      { key: 'orgs', label: '团体管理', perm: 'org.manage' },
      { key: 'quicklinks', label: '快捷通道', perm: 'quicklink.manage' },
      { key: 'shop', label: '积分商城', perm: 'shop.manage' },
      { key: 'wishes', label: '许愿单', perm: 'wish.review' },
      { key: 'badges', label: '徽章管理', perm: 'badge.manage' },
      { key: 'template', label: '识别模板', perm: 'template.manage' },
      // 站点配置类 + 角色管理 仅超级管理员可见 (role.manage / settings.* 为超管专属权限)
      ...(isSuper ? [
        { key: 'roles' as AdminTab, label: '角色管理', perm: 'role.manage' },
        { key: 'email' as AdminTab, label: '邮件配置', perm: 'settings.email' },
        { key: 'settings' as AdminTab, label: '站点设置', perm: 'settings.site' },
        { key: 'agreement' as AdminTab, label: '协议管理', perm: 'settings.agreement' },
      ] : []),
    ];
    const adminTabs = allTabs.filter(t => !t.perm || hasPerm(t.perm));
    const tab = view as AdminTab;
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
          <EditProfile user={user} forcePhone={forcePhone} refreshUser={refreshUser} onSaved={() => { refreshUser?.(); if (!forcePhone) setView('home'); else router.push('/'); }} />
        </div>
      </div>
    );
  }

  // ---- 首页视图 ----
  const idApproved = user.verificationStatus === 'APPROVED' || !!user.verified;
  const menuItems = [
    { key: 'homepage', label: '我的主页', icon: '🏠' },
    ...(idApproved
      ? [{ key: 'qualification', label: '资质/荣誉认证', icon: '🏅' }]
      : [{ key: 'verification', label: '身份认证', icon: '✅' }]),
    { key: 'violations', label: '违规与信用', icon: '📋' },
    { key: 'badges', label: '证书/徽章', icon: '🎖️' },
    { key: 'checkin', label: '签到积分', icon: '🪙' },
    { key: 'wish', label: '许愿单', icon: '🎯' },
    { key: 'security', label: '账户与安全', icon: '🔒' },
    ...(isAdmin ? [{ key: 'admin', label: '管理后台', icon: '⚙️' }] : []),
    { key: 'about', label: '关于校园墙', icon: 'ℹ️' },
    { key: 'contact', label: '联系我们', icon: '💬' },
  ];

  const handleMenu = (key: string) => {
    if (key === 'homepage' && user) { router.push(`/users/${user.id}`); return; }
    if (key === 'admin') { setView('overview'); return; }
    if (key === 'verification') { router.push('/verify'); return; }
    if (key === 'qualification') { setShowVerifyModal(true); return; }
    if (key === 'violations') { setView('violations'); return; }
    if (key === 'badges') { setView('my-badges'); return; }
    if (key === 'checkin') { setView('checkin'); return; }
    if (key === 'wish') { setView('wish'); return; }
    if (key === 'security') { setView('security'); return; }
    if (key === 'about') { router.push('/about'); return; }
    if (key === 'contact') { setView('contact'); return; }
    alert(`「${menuItems.find(m => m.key === key)?.label}」功能开发中…`);
  };

  // ---- 违规与信用视图 ----
  if (view === 'violations' && user) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">违规与信用</h3>
            <span className="text-sm text-gray-500">诚信分: <span className="font-bold text-green-600">{user.credibilityScore}</span></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => router.push('/profile/violations')} className="rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-sm font-medium text-gray-800">违规记录</div>
              <div className="text-xs text-gray-400 mt-0.5">查看历史违规</div>
            </button>
            <button onClick={() => router.push('/profile/ban-appeal')} className="rounded-xl border border-gray-200 p-4 text-left hover:bg-gray-50">
              <div className="text-2xl mb-1">✊</div>
              <div className="text-sm font-medium text-gray-800">违规申诉</div>
              <div className="text-xs text-gray-400 mt-0.5">对封禁提出申诉</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 账户与安全视图 ----
  if (view === 'security' && user) {
    const verified = user.verificationStatus === 'APPROVED';
    const securityItems = [
      { key: 'password', label: '修改密码', icon: '🔑', onClick: () => setShowPwdModal(true) },
      { key: 'notif', label: '通知设置', icon: '🔔', onClick: () => setShowNotifModal(true) },
      { key: 'privacy', label: '隐私设置', icon: '⚙️', onClick: () => setShowPrivacyModal(true) },
      { key: 'agreement', label: '用户协议', icon: '📄', onClick: () => router.push('/agreement') },
      { key: 'privacyPolicy', label: '隐私政策', icon: '🛡️', onClick: () => router.push('/privacy') },
    ];
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>

        {/* 实名信息卡片 (已认证, 跟随管理员设置的实名字段) */}
        {verified && (
          <div className="rounded-2xl bg-white shadow-sm p-6">
            <div className="flex flex-col items-center">
              {/* 绿色对勾图标 */}
              <div className="mb-3 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-10 w-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-base font-medium text-gray-800 mb-1">实名认证成功</div>
              <div className="text-xs text-gray-400 mb-4">实名信息认证后不可修改</div>
              {/* 实名信息 (仅显示管理员填写过的字段) */}
              <div className="w-full border-t border-gray-100 pt-4 space-y-2">
                {user.realName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">真实姓名</span>
                    <span className="text-gray-800">{user.realName}</span>
                  </div>
                )}
                {user.studentId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">学号</span>
                    <span className="text-gray-800">{user.studentId}</span>
                  </div>
                )}
                {user.grade && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">年级</span>
                    <span className="text-gray-800">{user.grade}</span>
                  </div>
                )}
                {user.className && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">班级</span>
                    <span className="text-gray-800">{user.className}</span>
                  </div>
                )}
                {user.school?.name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">学校</span>
                    <span className="text-gray-800">{user.school.name}</span>
                  </div>
                )}
              </div>
              {/* 底部更改入口 */}
              <button
                onClick={async () => {
                  if (!confirm('申请更改实名信息需重新提交认证, 原认证将被重置。确定继续?')) return;
                  try {
                    await api.del('/api/users/me/verification');
                    await refreshUser();
                    setView('home');
                    // 清除今天的提醒标记, 让下次进入时弹出提醒
                    localStorage.removeItem('auth_reminder_date');
                  } catch (e: any) {
                    alert(e.message || '操作失败');
                  }
                }}
                className="mt-4 text-xs text-gray-400"
              >
                不是我的实名, 需要<span className="text-blue-500">更改</span>
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {securityItems.map((item, idx) => (
            <div key={item.key} onClick={item.onClick} className={`flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
              <span className="text-xl">{item.icon}</span>
              <span className="flex-1 text-[15px] text-gray-800">{item.label}</span>
              <Arrow />
            </div>
          ))}
        </div>

        {/* 第三方账号绑定 */}
        <AccountBindingsCard userId={user.id} />

        {/* 修改密码弹窗 */}
        {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}

        {/* 通知设置弹窗 */}
        {showNotifModal && <NotificationSettingsModal onClose={() => setShowNotifModal(false)} />}

        {/* 隐私设置弹窗 */}
        {showPrivacyModal && <PrivacySettingsModal onClose={() => setShowPrivacyModal(false)} onSaved={() => refreshUser?.()} />}
      </div>
    );
  }

  // ---- 我的勋章视图 ----
  if (view === 'my-badges') {
    return <BadgesView onBack={() => setView('home')} />;
  }

  // ---- 签到积分视图 ----
  if (view === 'checkin') {
    return <CheckInView onBack={() => setView('home')} onPointsChanged={() => refreshUser()} />;
  }

  // ---- 许愿单视图 ----
  if (view === 'wish') {
    return <WishView onBack={() => setView('home')} />;
  }

  // ---- 联系我们视图 ----
  if (view === 'contact') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>
        <div className="rounded-2xl bg-white p-6 shadow-sm text-center space-y-4">
          <div className="text-5xl">💬</div>
          <h3 className="text-lg font-bold text-gray-900">联系我们</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>🕐 服务时间: <span className="font-medium">每天 8:00 - 23:00</span></p>
            <p>📅 节假日正常服务</p>
            <p className="pt-2">联系方式: <span className="font-medium text-green-600">企业微信</span></p>
            <p className="text-xs text-gray-400">请在服务时间内通过企业微信联系客服</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- 切换账号视图 ----
  if (view === 'account-switch' && user) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          返回
        </button>

        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-base font-bold text-gray-900">切换账号</div>
            <div className="text-xs text-gray-400 mt-0.5">最多 {maxAccounts} 个账号, 点击直接切换</div>
          </div>
          {savedAccounts.map((acc, idx) => {
            const isCurrent = acc.userId === user.id;
            return (
              <div key={acc.userId} className={`flex items-center gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t border-gray-100' : ''} ${isCurrent ? 'bg-blue-50' : ''}`}>
                <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
                  {acc.avatar ? <img src={acc.avatar} alt="" className="h-full w-full object-cover" /> : (acc.nickname || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{acc.nickname}</div>
                  <div className="text-xs text-gray-400">{acc.role === 'SUPER_ADMIN' ? '超级管理员' : acc.role === 'ADMIN' ? '管理员' : '用户'}</div>
                </div>
                {isCurrent ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-600 font-medium">当前</span>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        await switchAccount(acc.userId);
                        setView('home');
                      } catch (e: any) {
                        alert(e.message || '切换失败, 该账号可能已过期');
                      }
                    }}
                    className="rounded-full bg-blue-500 px-4 py-1.5 text-xs text-white font-medium hover:bg-blue-600"
                  >
                    切换
                  </button>
                )}
                {!isCurrent && (
                  <button
                    onClick={() => { if (confirm(`移除账号「${acc.nickname}」? 需重新登录才能切回`)) removeSavedAccount(acc.userId); }}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    移除
                  </button>
                )}
              </div>
            );
          })}
          {savedAccounts.length < maxAccounts && (
            <button
              onClick={() => router.push('/login?add=1')}
              className="w-full px-4 py-3.5 border-t border-gray-100 text-sm text-blue-500 hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/></svg>
              添加账号
            </button>
          )}
        </div>

        <button onClick={() => { logout(); router.push('/'); }} className="w-full rounded-2xl bg-white py-3.5 text-sm text-red-500 shadow-sm hover:bg-gray-50">
          退出当前账号
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 渐变头部 (管理员可配置背景图) */}
      <div className="-mx-4 -mt-3 px-4 pt-6 pb-12 relative overflow-hidden"
        style={profileBg ? { backgroundImage: `url(${profileBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {/* 无背景图时用渐变兜底 */}
        {!profileBg && <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400" />}
        {/* 半透明遮罩, 保证文字可读 */}
        {profileBg && <div className="absolute inset-0 bg-black/30" />}
        <div className="relative flex items-center gap-4">
          <button onClick={() => setShowAvatarLightbox(true)} className="h-16 w-16 overflow-hidden rounded-full bg-white/30 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white/40 shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.nickname || 'U')[0].toUpperCase()
            )}
          </button>
          <div className="flex-1 min-w-0">
            {user ? (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-lg font-bold text-white">{user.nickname}</span>
                  <VerifiedBadge verified={!!user.verified} className="!bg-white/20 !text-white" />
                  {user.qualificationVerified && user.qualificationType && (
                    <span className="rounded-full bg-purple-400/80 px-1.5 py-0.5 text-xs text-white">🏅 {user.qualificationType}</span>
                  )}
                </div>
                <div className="text-sm text-white/80 mt-0.5">{user.email || '未绑定邮箱'}</div>
                {user.userNumber != null && (
                  <div className="text-xs text-white/60 mt-0.5 tracking-wide">
                    <span className="text-white/40">Nº</span> {formatUserCode(user.userNumber, !!user.verified)}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  {user.school && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/80 px-2 py-0.5 text-xs font-medium text-white">🏫 {user.school.name}</span>
                  )}
                  {user.organization && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-400/80 px-2 py-0.5 text-xs font-medium text-white">👥 {user.organization.name}</span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-medium text-yellow-900">🪙 {user.points || 0} 积分</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-white">未登录</div>
                <div className="text-sm text-white/80">登录后查看更多内容</div>
              </>
            )}
          </div>
          {user ? (
            <button onClick={() => setView('edit')} className="rounded-full bg-white/20 px-3 py-1.5 text-sm text-white shrink-0">编辑</button>
          ) : (
            <button onClick={() => router.push('/login')} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-blue-600 shrink-0">立即登录 / 注册</button>
          )}
        </div>
      </div>

      {/* 统计卡片: 帖子 / 获赞 / 收藏 / 评论 (实时计数) */}
      <div className="-mt-8 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '帖子', value: counts.posts ?? 0, color: 'text-purple-500' },
            { label: '获赞', value: counts.likesReceived ?? 0, color: 'text-red-500' },
            { label: '收藏', value: counts.favorites ?? 0, color: 'text-amber-500' },
            { label: '评论', value: counts.comments ?? 0, color: 'text-blue-500' },
          ].map(s => {
            // 值为 0 时用淡灰色, 避免出现"突兀的彩色 0"
            const dim = (s.value as number) === 0;
            return (
              <div key={s.label} className="flex flex-col items-center py-2">
                <div className={`text-xl font-bold ${dim ? 'text-gray-300' : s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            );
          })}
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

      {/* 切换账号 + 退出登录 */}
      {user && (
        <div className="space-y-2">
          {savedAccounts.length >= 1 && (
            <button
              onClick={() => setView('account-switch')}
              className="w-full rounded-2xl bg-white py-3.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              切换账号
            </button>
          )}
          <button onClick={() => { logout(); router.push('/'); }} className="w-full rounded-2xl bg-white py-3.5 text-sm text-red-500 shadow-sm hover:bg-gray-50">
            退出登录
          </button>
        </div>
      )}

      {/* 头像放大灯箱 */}
      {showAvatarLightbox && user?.avatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowAvatarLightbox(false)}>
          <img src={user.avatar} alt="" className="max-h-[80vh] max-w-[90vw] rounded-xl" />
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}

      {/* 通知设置弹窗 */}
      {showNotifModal && <NotificationSettingsModal onClose={() => setShowNotifModal(false)} />}

      {/* 隐私设置弹窗 */}
      {showPrivacyModal && <PrivacySettingsModal onClose={() => setShowPrivacyModal(false)} onSaved={() => refreshUser?.()} />}

      {/* 加入学校/团体引导弹窗 */}
      {showJoinOrg && (
        <JoinOrgModal
          onClose={() => { setShowJoinOrg(false); setJoinOrgDismissed(true); }}
          onJoined={() => { setShowJoinOrg(false); refreshUser(); }}
        />
      )}

      {/* 未认证每日提醒弹窗 */}
      {showAuthReminder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            {/* 大图标 */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <svg className="h-9 w-9 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-center text-lg font-bold text-gray-800">建议完成身份认证</h3>
            <p className="mt-2 text-center text-sm text-gray-500 leading-relaxed">
              完成身份认证后可解锁发帖、评论、点赞、关注等功能, 同时享受更高的信任标识和权限。
            </p>
            {/* 权益受限说明 */}
            <div className="mt-4 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700 space-y-1">
              <div className="flex items-center gap-1.5"><span>🔒</span><span>未认证将限制发帖、评论、点赞</span></div>
              <div className="flex items-center gap-1.5"><span>⚠️</span><span>无法申请徽章和资质认证</span></div>
              <div className="flex items-center gap-1.5"><span>❓</span><span>社区信任标识不显示</span></div>
            </div>
            {/* 按钮 */}
            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  localStorage.setItem('auth_reminder_date', new Date().toISOString().slice(0, 10));
                  setShowAuthReminder(false);
                  router.push('/verify');
                }}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
              >
                立即认证
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('auth_reminder_date', new Date().toISOString().slice(0, 10));
                  setShowAuthReminder(false);
                }}
                className="w-full rounded-xl bg-gray-100 py-3 text-sm text-gray-600 hover:bg-gray-200"
              >
                我再想想
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 实名认证弹窗 */}
      {showVerifyModal && user && (
        <VerificationModal
          user={user}
          initialType={verifyModalInitial}
          onClose={() => { setShowVerifyModal(false); setVerifyModalInitial(null); }}
          onVerified={() => { refreshUser(); setShowVerifyModal(false); setVerifyModalInitial(null); }}
          onSubmitted={() => refreshUser()}
          onLater={() => {
            // 用户点了「我再想想」: 关闭弹窗并在"认证"菜单入口提示
            setShowVerifyModal(false); setVerifyModalInitial(null);
          }}
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

// ---------- 隐私设置弹窗 ----------
function PrivacySettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [settings, setSettings] = useState<{ followsPublic: boolean; fansPublic: boolean; badgesPublic: boolean; honorsPublic: boolean; favoritesPublic: boolean; likesPublic: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // 加载时读取当前隐私设置
  useEffect(() => {
    api.get('/api/users/me')
      .then((u: any) => {
        setSettings({
          followsPublic: !!u.followsPublic,
          fansPublic: !!u.fansPublic,
          badgesPublic: !!u.badgesPublic,
          honorsPublic: !!u.honorsPublic,
          favoritesPublic: !!u.favoritesPublic,
          likesPublic: !!u.likesPublic,
        });
      })
      .catch(console.error);
  }, []);

  const toggle = (k: keyof NonNullable<typeof settings>) => {
    if (!settings) return;
    setSettings({ ...settings, [k]: !settings[k] });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true); setMsg('');
    try {
      await api.patch('/api/users/me', settings);
      setMsg('保存成功');
      onSaved?.();
      // 800ms 后关闭弹窗
      setTimeout(() => onClose(), 800);
    } catch (e: any) {
      setMsg(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const items: { key: keyof NonNullable<typeof settings>; label: string; desc: string }[] = [
    { key: 'followsPublic', label: '我的关注列表', desc: '别人能否看到我关注了谁' },
    { key: 'fansPublic', label: '我的粉丝列表', desc: '别人能否看到我的粉丝' },
    { key: 'badgesPublic', label: '我的勋章展示', desc: '主页是否对外展示我的勋章' },
    { key: 'honorsPublic', label: '荣誉证书展示', desc: '主页是否对外展示我的证书' },
    { key: 'favoritesPublic', label: '我的收藏数', desc: '主页是否显示收藏总数' },
    { key: 'likesPublic', label: '我的获赞数', desc: '主页是否显示获赞总数' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">隐私设置</h3>
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
        <button onClick={save} disabled={saving || !settings} className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
      </div>
    </div>
  );
}

// ---------- 认证弹窗 (身份认证 / 资质荣誉认证) ----------
type VerifyType = 'IDENTITY' | 'QUALIFICATION';

// 身份认证已独立到 /verify 页面, 此弹窗只处理资质/荣誉认证
const VERIFY_TYPE_OPTIONS: { value: VerifyType; label: string; icon: string; desc: string }[] = [
  { value: 'QUALIFICATION', label: '资质/荣誉认证', icon: '🏅', desc: '学生会/广播站/证书等, 可重复认证' },
];

function VerificationModal({ user, initialType, onClose, onVerified, onSubmitted, onLater }: { user: any; initialType?: 'IDENTITY' | 'QUALIFICATION' | null; onClose: () => void; onVerified: () => void; onSubmitted?: () => void; onLater?: () => void }) {
  const [photo, setPhoto] = useState<string>('');
  const [photo2, setPhoto2] = useState<string>(''); // 第二张照片 (卡面反面/证书内页)
  const [templateId, setTemplateId] = useState<string>('');
  const [verifyType, setVerifyType] = useState<VerifyType | ''>('');
  const [photoType, setPhotoType] = useState<'CARD' | 'FACE'>('CARD');
  const [faceName, setFaceName] = useState('');
  const [faceId, setFaceId] = useState('');
  const [qualName, setQualName] = useState(''); // 资质/荣誉名称
  const [qualCategory, setQualCategory] = useState<'QUALIFICATION' | 'HONOR'>('QUALIFICATION'); // 资质 / 荣誉
  const [qualList, setQualList] = useState<any[]>([]); // 我的资质/荣誉列表
  const [templates, setTemplates] = useState<{ id: string; name: string; type: string; image: string; isActive: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // 本地认证状态 (提交后用于实时展示进度, 轮询刷新)
  const [localStatus, setLocalStatus] = useState<string>(user.verificationStatus || 'NONE');
  const [localRejectReason, setLocalRejectReason] = useState<string>(user.verificationRejectReason || '');

  // 根据所选认证类型加载对应模板
  useEffect(() => {
    if (!verifyType) { setTemplates([]); return; }
    api.get<{ templates: { id: string; name: string; type: string; image: string; isActive: boolean }[] }>(`/api/verification-templates?type=${verifyType}`)
      .then(d => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, [verifyType]);

  const [localQualStatus, setLocalQualStatus] = useState<string>(user.qualificationStatus || 'NONE');

  const refreshStatus = useCallback(async () => {
    try {
      const d = await api.get<{ verificationStatus: string; verificationRejectReason?: string; verified?: boolean }>('/api/users/me/verification');
      setLocalStatus(d.verificationStatus || 'NONE');
      setLocalRejectReason(d.verificationRejectReason || '');
      if (d.verified || d.verificationStatus === 'APPROVED') onVerified();
    } catch { /* ignore */ }
  }, [onVerified]);

  // 刷新资质认证列表 (提交后/轮询时调用)
  const refreshQualStatus = useCallback(async () => {
    try {
      const d = await api.get<{ items: any[] }>('/api/users/me/qualifications');
      const list = d.items || [];
      setQualList(list);
      // 若有任意一条待审核, 则视为 PENDING
      const hasPending = list.some((q: any) => q.status === 'PENDING');
      setLocalQualStatus(hasPending ? 'PENDING' : 'NONE');
    } catch { /* ignore */ }
  }, []);

  const role = user.role || 'STUDENT';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const currentTypeMeta = VERIFY_TYPE_OPTIONS.find(o => o.value === verifyType);
  const verifyLabel = currentTypeMeta?.label || '认证';
  const isQual = verifyType === 'QUALIFICATION';
  const photoLabel = photoType === 'FACE'
    ? '人脸照片'
    : isQual ? '证明材料' : '校园卡/工牌';
  const isFace = photoType === 'FACE';

  // 打开资质/荣誉认证时加载已有列表
  useEffect(() => {
    if (isQual) refreshQualStatus();
  }, [isQual, refreshQualStatus]);

  // 弹窗只处理资质/荣誉认证, 打开即默认 QUALIFICATION
  useEffect(() => {
    if (!verifyType) setVerifyType('QUALIFICATION');
  }, [verifyType]);

  // 身份认证 vs 资质认证 使用各自独立的状态字段, 互不污染
  const idStatus = localStatus || user.verificationStatus || 'NONE';
  const qualStatus = localQualStatus || user.qualificationStatus || 'NONE';
  // 超级管理员身份认证自动通过; 资质认证需手动提交
  const idApproved = isSuperAdmin || user.verified || idStatus === 'APPROVED';
  const qualApproved = user.qualificationVerified || qualStatus === 'APPROVED';

  const isApproved = isQual ? qualApproved : idApproved;
  const status = isQual ? qualStatus : idStatus;
  const isAiReviewing = !isQual && status === 'AI_REVIEWING';
  const isPending = status === 'PENDING';
  const isRejected = status === 'REJECTED';
  const inProgress = isAiReviewing || isPending;

  // AI 初审 / 人工复核期间轮询刷新状态 (每 3 秒)
  useEffect(() => {
    if (!isAiReviewing && !isPending) return;
    const refresh = isQual ? refreshQualStatus : refreshStatus;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [isAiReviewing, isPending, isQual, refreshStatus, refreshQualStatus]);

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

  const onCapture = (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'photo2' = 'photo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg('');
    compress(file).then(dataUrl => {
      if (target === 'photo2') setPhoto2(dataUrl);
      else setPhoto(dataUrl);
    }).catch(() => setMsg('图片处理失败, 请重试'));
    e.target.value = '';
  };

  const submit = async () => {
    if (isQual) {
      if (!qualName.trim()) { setMsg('请填写资质/荣誉名称'); return; }
      // 资质/荣誉认证的证明材料可选 (拍照或上传均可, 不强制)
      setBusy(true); setMsg('');
      try {
        const payload: any = { type: qualName.trim(), category: qualCategory };
        if (photo) payload.photo = photo;
        if (photo2) payload.photo2 = photo2;
        const res: any = await api.post('/api/users/me/qualifications', payload);
        setMsg(res?.message || '资质认证申请已提交');
        await refreshQualStatus();
        onSubmitted?.();
        setPhoto('');
        setPhoto2('');
        setQualName('');
      } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
      return;
    }
    if (!isFace && !templateId) { setMsg('请先选择模板'); return; }
    if (isFace && !faceName.trim()) { setMsg('请填写姓名'); return; }
    if (isFace && !faceId.trim()) { setMsg('请填写工号/学号'); return; }
    if (!photo) { setMsg(`请先拍摄${photoLabel}`); return; }
    setBusy(true); setMsg('');
    try {
      const payload: any = { photo, photoType };
      if (!isFace) payload.templateId = templateId;
      if (isFace) {
        payload.faceName = faceName.trim();
        payload.faceId = faceId.trim();
      }
      const res: any = await api.post('/api/users/me/verification', payload);
      setMsg(res?.message || '认证申请已提交');
      await refreshStatus();
      onSubmitted?.();
      setPhoto('');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  // 选中的模板 (用于显示案例图)
  const selectedTemplate = templates.find(t => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h3 className="text-base font-bold text-gray-900">{verifyLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-4">

        {isApproved ? (
          <div className="rounded-xl bg-green-50 p-4 text-center">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-sm font-medium text-green-700">已{verifyLabel}</div>
            {isQual ? (
              user.qualificationVerifiedAt && <div className="text-xs text-green-600 mt-1">认证时间: {new Date(user.qualificationVerifiedAt).toLocaleDateString('zh-CN')}</div>
            ) : (
              user.verifiedAt && <div className="text-xs text-green-600 mt-1">认证时间: {new Date(user.verifiedAt).toLocaleDateString('zh-CN')}</div>
            )}
            {isQual && <div className="text-xs text-gray-400 mt-1">可重新提交新的资质/荣誉认证</div>}
          </div>
        ) : inProgress ? (
          <div className="rounded-xl bg-amber-50 p-4">
            <div className="relative flex items-center justify-between px-1 mb-3">
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
            <div className="text-sm font-medium text-red-700">❌ {verifyLabel}被驳回</div>
            {(isQual ? user.qualificationRejectReason : (user.verificationRejectReason || localRejectReason)) ? (
              <div className="text-xs text-red-600 mt-1">原因: {isQual ? user.qualificationRejectReason : (user.verificationRejectReason || localRejectReason)}</div>
            ) : null}
            <div className="text-xs text-red-500 mt-1">请重新提交{isQual ? '资质/荣誉' : ''}材料后再次提交</div>
          </div>
        ) : null}

        {/* 第一步: 选择认证类型 (管理员跳过, 直接走资质/荣誉认证) */}
        {!isAdmin && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择认证类型</label>
            {idApproved && !isQual && (
              <div className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                ✅ 身份认证已通过, 建议继续完成资质/荣誉认证
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {VERIFY_TYPE_OPTIONS.map(opt => {
                const optIsId = opt.value === 'IDENTITY';
                const optIsIdDone = optIsId && idApproved;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setVerifyType(opt.value); setTemplateId(''); setPhoto(''); }}
                    disabled={optIsIdDone}
                    className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-3 transition ${
                      verifyType === opt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    } ${optIsIdDone ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {optIsIdDone && (
                      <span className="absolute top-1 right-1 flex items-center gap-0.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] text-white">
                        ✅ 已通过
                      </span>
                    )}
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className={`text-xs font-medium ${verifyType === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 其余表单字段: 仅当选了类型且可提交时显示
            - 资质/荣誉认证: 所有人(含超管)均可随时重复提交
            - 身份认证: 非超管且未通过、非审核中时可提交 */}
        {verifyType && (isQual || (!isSuperAdmin && !isApproved && !isPending && !isAiReviewing)) && (
          <>
            {/* 资质/荣誉认证: 选择类别 + 填写名称 */}
            {isQual && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">类别</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setQualCategory('QUALIFICATION')}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 transition ${
                        qualCategory === 'QUALIFICATION' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">🎖️</div>
                      <div className={`text-xs font-medium ${qualCategory === 'QUALIFICATION' ? 'text-blue-700' : 'text-gray-700'}`}>资质认证</div>
                    </button>
                    <button
                      onClick={() => setQualCategory('HONOR')}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 transition ${
                        qualCategory === 'HONOR' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">🏆</div>
                      <div className={`text-xs font-medium ${qualCategory === 'HONOR' ? 'text-blue-700' : 'text-gray-700'}`}>荣誉认证</div>
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{qualCategory === 'HONOR' ? '荣誉' : '资质'}名称</label>
                  <input
                    type="text"
                    value={qualName}
                    onChange={e => setQualName(e.target.value)}
                    placeholder={qualCategory === 'HONOR' ? '如: 优秀志愿者 / 数学竞赛一等奖' : '如: 学生会主席 / 小黄人应急救护员'}
                    maxLength={50}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>

                {/* 我的资质/荣誉列表 */}
                {qualList.length > 0 && (
                  <div className="mb-3 rounded-xl bg-gray-50 p-3">
                    <div className="text-xs font-medium text-gray-600 mb-2">我的{qualCategory === 'HONOR' ? '荣誉' : '资质'}记录</div>
                    <div className="space-y-1.5">
                      {qualList.map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={q.category === 'HONOR' ? 'text-amber-500' : 'text-purple-500'}>{q.category === 'HONOR' ? '🏆' : '🎖️'}</span>
                            <span className="text-gray-700 truncate">{q.type}</span>
                          </div>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 ${
                            q.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            q.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                            q.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {q.status === 'APPROVED' ? '已通过' : q.status === 'PENDING' ? '待审核' : q.status === 'REJECTED' ? '已驳回' : '未提交'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 第二步: 选择照片类型 (卡面 / 人脸) — 仅身份认证 */}
            {verifyType && !isQual && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">上传方式</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setPhotoType('CARD'); setPhoto(''); }}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 transition ${
                      photoType === 'CARD' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">💳</div>
                    <div className={`text-xs font-medium ${photoType === 'CARD' ? 'text-blue-700' : 'text-gray-700'}`}>证件卡面</div>
                  </button>
                  <button
                    onClick={() => { setPhotoType('FACE'); setTemplateId(''); setPhoto(''); }}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 transition ${
                      photoType === 'FACE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">😊</div>
                    <div className={`text-xs font-medium ${photoType === 'FACE' ? 'text-blue-700' : 'text-gray-700'}`}>人脸照片</div>
                  </button>
                </div>
              </div>
            )}

            {/* 第三步: 仅身份认证的卡面需选择模板; 资质/荣誉认证不需要模板 */}
            {verifyType && (
              <>
                {/* 卡面: 选择模板 + 显示案例图 (资质/荣誉认证跳过) */}
                {!isQual && !isFace && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">选择模板</label>
                    {templates.length === 0 ? (
                      <div className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-400">
                        暂无{currentTypeMeta?.label}模板, 请联系管理员添加
                      </div>
                    ) : (
                      <select
                        value={templateId}
                        onChange={e => setTemplateId(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">请选择模板</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* 卡面: 选中模板后显示案例图 (资质/荣誉认证跳过) */}
                {!isQual && !isFace && selectedTemplate && selectedTemplate.image && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-600 mb-1.5">模板示例 (请参照此样式拍摄)</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedTemplate.image} alt="模板示例" className="w-full rounded-xl border border-gray-200" />
                  </div>
                )}

                {/* 拍摄注意事项 (资质材料 / 卡面 / 人脸不同) */}
                <div className="rounded-xl bg-amber-50 p-3 mb-3">
                  <div className="text-sm font-medium text-amber-800 mb-1.5">📸 拍摄注意事项</div>
                  {isQual ? (
                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                      <li>请将{photoLabel}完整拍摄, 确保文字、印章、头像清晰可辨认</li>
                      <li>光线充足均匀, 避免反光、阴影遮挡关键信息</li>
                      <li>画面端正, 不要倾斜或模糊</li>
                      <li>只拍摄{photoLabel}本身, 不要包含其他杂物</li>
                      <li>支持证书、奖状、聘书、证明文件等证明材料</li>
                    </ul>
                  ) : isFace ? (
                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                      <li>请正对镜头, 露出完整面部 (额头、眼睛、鼻子、嘴巴)</li>
                      <li>光线充足均匀, 避免逆光、阴影遮挡脸部</li>
                      <li>表情自然, 不要戴墨镜、帽子等遮挡物</li>
                      <li>人脸占画面比例适中 (约 1/3 到 1/2)</li>
                      <li>照片清晰, 五官可辨认, 避免模糊</li>
                    </ul>
                  ) : (
                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                      <li>请将{photoLabel}平放, 保持画面端正, 不要倾斜</li>
                      <li>确保照片清晰, 文字和头像可辨认, 避免模糊</li>
                      <li>光线充足, 避免反光、阴影遮挡关键信息</li>
                      <li>只拍摄{photoLabel}本身, 不要包含其他杂物</li>
                      <li>照片需完整显示{photoLabel}的全部内容</li>
                    </ul>
                  )}
                </div>

                {/* 人脸照片: 必须填写姓名和工号/学号 (供管理员核对身份) */}
                {isFace && (
                  <div className="rounded-xl bg-blue-50 p-3 mb-3 space-y-2">
                    <div className="text-sm font-medium text-blue-800 mb-1">📝 填写身份信息 (管理员将据此核对)</div>
                    <div>
                      <label className="block text-xs text-blue-700 mb-1">姓名 <span className="text-red-500">*</span></label>
                      <input
                        value={faceName}
                        onChange={e => setFaceName(e.target.value)}
                        placeholder="请输入真实姓名"
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-700 mb-1">工号/学号 <span className="text-red-500">*</span></label>
                      <input
                        value={faceId}
                        onChange={e => setFaceId(e.target.value)}
                        placeholder="请输入工号或学号"
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                )}

                {/* 照片上传区
                    - 资质/荣誉认证: 支持上传两张 (正面/封面 + 反面/内页), 均可选
                    - 身份认证: 单张照片 */}
                {isQual ? (
                  <div className="mb-3 space-y-3">
                    {/* 第一张: 正面/封面 */}
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1.5">证明材料 ① (正面/封面) <span className="text-gray-400 font-normal">— 可选</span></div>
                      {photo ? (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo} alt="证明材料正面" className="w-full rounded-xl border border-gray-200" />
                          <button onClick={() => setPhoto('')} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white text-sm">✕</button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                            <svg className="h-7 w-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                            <span className="text-xs text-blue-600 font-medium">拍照</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onCapture(e, 'photo')} />
                          </label>
                          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                            <svg className="h-7 w-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="text-xs text-blue-600 font-medium">从相册上传</span>
                            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => onCapture(e, 'photo')} />
                          </label>
                        </div>
                      )}
                    </div>
                    {/* 第二张: 反面/内页 */}
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1.5">证明材料 ② (反面/内页) <span className="text-gray-400 font-normal">— 可选, 卡面类建议上传</span></div>
                      {photo2 ? (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo2} alt="证明材料反面" className="w-full rounded-xl border border-gray-200" />
                          <button onClick={() => setPhoto2('')} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white text-sm">✕</button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                            <svg className="h-7 w-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                            <span className="text-xs text-blue-600 font-medium">拍照</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onCapture(e, 'photo2')} />
                          </label>
                          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                            <svg className="h-7 w-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="text-xs text-blue-600 font-medium">从相册上传</span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => onCapture(e, 'photo2')} />
                          </label>
                        </div>
                      )}
                    </div>
                    <p className="text-center text-xs text-gray-400">如为卡面类资质 (如工作证/会员卡), 建议上传正反面; 证书类可只传封面</p>
                  </div>
                ) : photo ? (
                  <div className="relative mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={photoLabel} className="w-full rounded-xl border border-gray-200" />
                    <button onClick={() => setPhoto('')} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white text-sm">✕</button>
                  </div>
                ) : (
                  <div className="mb-3">
                    {/* 身份认证 (人脸/卡面): 仅支持现场拍照, 不允许从相册选择 */}
                    <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                      <svg className="h-10 w-10 text-gray-400 mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span className="text-sm text-blue-600 font-medium">{isFace ? '拍摄人脸照片' : '拍摄卡面照片'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture={isFace ? 'user' : 'environment'}
                        className="hidden"
                        onChange={onCapture}
                      />
                    </label>
                    <p className="mt-2 text-center text-xs text-gray-400">身份认证仅支持现场拍照, 不支持从相册选择</p>
                  </div>
                )}

                {msg && <p className={`mb-3 text-sm ${msg.includes('已提交') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}

                <button onClick={submit} disabled={busy || (!isQual && !photo) || (!isQual && !isFace && !templateId)} className="w-full rounded-full bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {busy ? '提交中…' : `提交${verifyLabel}申请`}
                </button>
              </>
            )}
          </>
        )}

        {(isPending || isAiReviewing) && (
          <p className="mt-3 text-center text-xs text-gray-400">审核期间无法重复提交, 请等待结果</p>
        )}
        </div>
      </div>
    </div>
  );
}
