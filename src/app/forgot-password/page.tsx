'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Step = 'account' | 'verify' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('account');
  const [account, setAccount] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 第 1 步: 输入账号, 自动发送验证码
  const sendCode = async () => {
    setErr('');
    if (!account.trim()) { setErr('请输入账号名、手机号或邮箱'); return; }
    setBusy(true);
    try {
      const res: any = await api.post('/api/auth/forgot-password/send-code', { account });
      setMaskedEmail(res.maskedEmail || '');
      setStep('verify');
      setCountdown(60);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // 重新发送验证码
  const resend = async () => {
    setErr('');
    setBusy(true);
    try {
      const res: any = await api.post('/api/auth/forgot-password/send-code', { account });
      setMaskedEmail(res.maskedEmail || maskedEmail);
      setCountdown(60);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // 第 2 步: 输入验证码, 进入重置密码
  const verify = () => {
    setErr('');
    if (code.length !== 6) { setErr('请输入6位验证码'); return; }
    setStep('reset');
  };

  // 第 3 步: 设置新密码
  const reset = async () => {
    setErr('');
    if (newPwd.length < 6) { setErr('密码至少6位'); return; }
    if (newPwd !== confirmPwd) { setErr('两次输入的密码不一致'); return; }
    setBusy(true);
    try {
      await api.post('/api/auth/forgot-password/reset', { account, code, newPassword: newPwd });
      setStep('done');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">找回密码</h1>
          <p className="text-sm text-slate-500 mt-1">通过邮箱验证码重置您的密码</p>
        </div>

        {/* 步骤指示 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['输入账号', '验证邮箱', '设置密码'].map((label, i) => {
            const idx = i + 1;
            const active = (step === 'account' && idx === 1) || (step === 'verify' && idx === 2) || (step === 'reset' && idx === 3) || step === 'done';
            const done = (step === 'verify' && idx <= 1) || (step === 'reset' && idx <= 2) || step === 'done';
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${done ? 'bg-blue-500 text-white' : active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                  {done ? '✓' : idx}
                </div>
                <span className={`text-xs ${active ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                {i < 2 && <div className={`h-px w-6 ${done ? 'bg-blue-500' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>

        {err && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{err}</div>}

        {/* 第 1 步: 输入账号 */}
        {step === 'account' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">账号</label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="账号名 / 手机号 / 邮箱"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              />
            </div>
            <button onClick={sendCode} disabled={busy} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition">
              {busy ? '发送中…' : '获取验证码'}
            </button>
            <p className="text-center text-sm text-slate-500">
              想起密码了？<Link href="/login" className="text-blue-500 font-medium">返回登录</Link>
            </p>
          </div>
        )}

        {/* 第 2 步: 输入验证码 */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">验证码已发送至邮箱</p>
              <p className="text-base font-semibold text-blue-600 mt-1">{maskedEmail}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="请输入6位验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={resend}
                  disabled={countdown > 0 || busy}
                  className="shrink-0 rounded-xl border border-blue-500 px-4 text-sm font-medium text-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  {countdown > 0 ? `${countdown}s` : '重新发送'}
                </button>
              </div>
            </div>
            <button onClick={verify} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition">
              下一步
            </button>
            <button onClick={() => setStep('account')} className="w-full py-3 text-sm text-slate-500 hover:text-slate-700">
              上一步
            </button>
          </div>
        )}

        {/* 第 3 步: 设置新密码 */}
        {step === 'reset' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">新密码</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入新密码 (至少6位)"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">确认新密码</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请再次输入新密码"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </div>
            <button onClick={reset} disabled={busy} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition">
              {busy ? '提交中…' : '确认重置'}
            </button>
            <button onClick={() => setStep('verify')} className="w-full py-3 text-sm text-slate-500 hover:text-slate-700">
              上一步
            </button>
          </div>
        )}

        {/* 第 4 步: 重置成功 */}
        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">密码重置成功</h2>
            <p className="text-sm text-slate-500">请使用新密码登录您的账号</p>
            <button onClick={() => router.push('/login')} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition">
              去登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
