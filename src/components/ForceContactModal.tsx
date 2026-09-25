'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';

// 强制完善必填信息 (真实姓名 + 手机号/邮箱二选一)
// 当用户登录后真实姓名为空, 或手机号和邮箱都为空时弹出, 不填写无法关闭
export default function ForceContactModal() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [realName, setRealName] = useState('');
  const [countryCode, setCountryCode] = useState('+86');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // 已登录且 (真实姓名为空) 或 (手机号和邮箱都为空) → 强制弹出
  useEffect(() => {
    if (user && (!user.realName || (!user.phoneNumber && !user.email))) {
      setRealName(user.realName || '');
      setCountryCode(user.countryCode || '+86');
      setPhone(user.phoneNumber || '');
      setEmail(user.email || '');
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user]);

  if (!open) return null;

  const country = getCountryByCode(countryCode);

  const submit = async () => {
    setErr('');
    if (!realName.trim()) { setErr('请输入真实姓名'); return; }

    // 手机号和邮箱至少填一个
    const hasPhone = phone.trim().length > 0;
    const hasEmail = email.trim().length > 0;
    if (!hasPhone && !hasEmail) {
      setErr('手机号和邮箱至少填写一个');
      return;
    }
    // 如果填了手机号, 校验格式
    if (hasPhone) {
      const v = validatePhone(countryCode, phone);
      if (!v.ok) { setErr(v.message || '手机号格式不正确'); return; }
    }
    // 如果填了邮箱, 校验格式
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('邮箱格式不正确');
      return;
    }

    setSaving(true);
    try {
      const payload: any = { realName: realName.trim() };
      if (hasPhone) { payload.countryCode = countryCode; payload.phoneNumber = phone; }
      if (hasEmail) { payload.email = email.trim(); }
      await api.patch('/api/users/me', payload);
      await refreshUser();
      setOpen(false);
    } catch (err: any) {
      setErr(err.message || '保存失败, 请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 11h-6M19 8v6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">完善个人信息</h2>
        </div>

        <p className="mb-5 text-center text-xs leading-relaxed text-gray-500">
          真实姓名为<span className="text-red-500">必填项</span>。
          <br />
          手机号和邮箱<span className="text-orange-500">至少填写一个</span>，用于
          <br />
          <span className="text-orange-500">身份识别、找回密码、接收验证码</span>等。
        </p>

        {/* 真实姓名 */}
        <div className="mb-3">
          <input
            value={realName}
            onChange={e => { setRealName(e.target.value); setErr(''); }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
            placeholder="请输入真实姓名"
            autoFocus
          />
        </div>

        {/* 手机号 (区号 + 号码) - 选填 */}
        <div className="space-y-2 mb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCountryPicker(true)}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800"
            >
              {country.code}
              <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setErr(''); }}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
              placeholder="手机号 (选填)"
              maxLength={Math.max(...country.lengths)}
            />
          </div>
        </div>

        {/* 邮箱 - 选填 */}
        <div className="mb-1">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setErr(''); }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
            placeholder="邮箱 (选填, 用于找回密码)"
          />
        </div>
        <p className="mb-1 text-xs text-gray-400">手机号和邮箱至少填写一个</p>

        {err && <p className="mt-2 text-center text-xs text-red-500">{err}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="mt-4 w-full rounded-full bg-blue-500 py-3.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中…' : '确定'}
        </button>
      </div>

      {/* 区号选择面板 */}
      {showCountryPicker && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50" onClick={() => setShowCountryPicker(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <h3 className="mb-4 text-center text-lg font-bold text-slate-900">选择国家/地区</h3>
            <div className="space-y-1">
              {COUNTRY_CODES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); setErr(''); }}
                  className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left ${c.code === countryCode ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                >
                  <span className="text-sm text-gray-800">{c.name}</span>
                  <span className="text-sm text-gray-500">{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
