'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { COUNTRY_CODES, getCountryByCode, validatePhone } from '@/lib/country-codes';

// 强制完善必填信息 (真实姓名 + 手机号)
// 当用户登录后真实姓名或手机号为空时弹出, 不填写无法关闭
export default function ForceContactModal() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [realName, setRealName] = useState('');
  const [countryCode, setCountryCode] = useState('+86');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // 已登录且真实姓名或手机号为空 → 强制弹出
  useEffect(() => {
    if (user && (!user.realName || !user.phoneNumber)) {
      setRealName(user.realName || '');
      setCountryCode(user.countryCode || '+86');
      setPhone(user.phoneNumber || '');
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
    const v = validatePhone(countryCode, phone);
    if (!v.ok) { setErr(v.message || '手机号格式不正确'); return; }

    setSaving(true);
    try {
      await api.patch('/api/users/me', {
        realName: realName.trim(),
        countryCode,
        phoneNumber: phone,
      });
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 11h-6M19 8v6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">完善个人信息</h2>
        </div>

        <p className="mb-5 text-center text-xs leading-relaxed text-gray-500">
          真实姓名和手机号为<span className="text-red-500">必填项</span>。
          <br />
          用于<span className="text-orange-500">身份识别、找回密码、接收验证码</span>等。
          <br />
          如未填写，将有可能<span className="text-red-500">无法找回密码</span>。
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

        {/* 手机号 (区号 + 号码) */}
        <div className="space-y-2">
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
            />
          </div>
          <p className="text-xs text-gray-400">{country.name}手机号 {country.lengths.join('/')} 位</p>
        </div>

        {err && <p className="mt-3 text-center text-xs text-red-500">{err}</p>}

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
