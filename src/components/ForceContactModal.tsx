'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';

type Mode = 'email' | 'phone';

// 强制完善联系方式 (邮箱或手机号, 二选一)
// 当用户登录后既无邮箱也无手机号时弹出, 不填写无法关闭
export default function ForceContactModal() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('phone');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+86');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // 已登录且邮箱、手机号都为空 → 强制弹出
  useEffect(() => {
    if (user && !user.email && !user.phoneNumber) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user]);

  if (!open) return null;

  const country = getCountryByCode(countryCode);

  const validate = (): string | null => {
    if (mode === 'email') {
      if (!email.trim()) return '请输入邮箱';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
      return null;
    } else {
      const v = validatePhone(countryCode, phone);
      return v.ok ? null : v.message || '手机号格式不正确';
    }
  };

  const submit = async () => {
    const e = validate();
    if (e) { setErr(e); return; }
    setSaving(true); setErr('');
    try {
      const payload: any = {};
      if (mode === 'email') payload.email = email.trim();
      else { payload.countryCode = countryCode; payload.phoneNumber = phone; }
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
      {/* 不提供关闭按钮, 点击遮罩也不关闭 */}
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">完善联系方式</h2>
        </div>

        <p className="mb-4 text-center text-xs leading-relaxed text-gray-500">
          该联系方式用于<span className="text-orange-500">找回密码、接收验证码</span>等。
          <br />
          如未填写，将有可能<span className="text-red-500">无法找回密码</span>。
          <br />
          请选择邮箱或手机号任选其一填写。
        </p>

        {/* 方式选择 */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => { setMode('phone'); setErr(''); }}
            className={`rounded-lg py-2 text-sm font-medium transition ${mode === 'phone' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            📱 手机号
          </button>
          <button
            onClick={() => { setMode('email'); setErr(''); }}
            className={`rounded-lg py-2 text-sm font-medium transition ${mode === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            ✉️ 邮箱
          </button>
        </div>

        {/* 手机号模式 */}
        {mode === 'phone' && (
          <div className="space-y-3">
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
                placeholder="请输入手机号"
                maxLength={Math.max(...country.lengths)}
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400">{country.name}手机号 {country.lengths.join('/')} 位</p>
          </div>
        )}

        {/* 邮箱模式 */}
        {mode === 'email' && (
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErr(''); }}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
              placeholder="请输入邮箱地址"
              autoFocus
            />
            <p className="text-xs text-gray-400">用于接收验证码和找回密码</p>
          </div>
        )}

        {err && <p className="mt-2 text-center text-xs text-red-500">{err}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="mt-5 w-full rounded-full bg-blue-500 py-3.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
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
