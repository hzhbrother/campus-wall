'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const { register, user: me, refreshUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    nickname: '',
    realName: '',
    password: '',
    confirmPassword: '',
    remark: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // === 邮箱绑定弹窗 ===
  const [showBindEmail, setShowBindEmail] = useState(false);
  const [bindEmail, setBindEmail] = useState('');
  const [bindEmailCode, setBindEmailCode] = useState('');
  const [bindMsg, setBindMsg] = useState('');
  const [bindBusy, setBindBusy] = useState(false);
  const [sendingBindCode, setSendingBindCode] = useState(false);
  const [bindCountdown, setBindCountdown] = useState(0);

  useEffect(() => {
    if (bindCountdown <= 0) return;
    const t = setTimeout(() => setBindCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [bindCountdown]);

  const sendBindCode = async () => {
    if (!bindEmail.trim()) { setBindMsg('请先输入邮箱'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bindEmail)) { setBindMsg('邮箱格式不正确'); return; }
    setSendingBindCode(true); setBindMsg('');
    try {
      await api.post('/api/users/me/email/send-code', { email: bindEmail.trim() });
      setBindCountdown(60);
      setBindMsg('验证码已发送, 请查收邮件');
    } catch (e: any) { setBindMsg(e.message); }
    finally { setSendingBindCode(false); }
  };

  const confirmBindEmail = async () => {
    if (!bindEmail.trim()) { setBindMsg('请输入邮箱'); return; }
    if (!bindEmailCode.trim()) { setBindMsg('请输入验证码'); return; }
    setBindBusy(true); setBindMsg('');
    try {
      await api.patch('/api/users/me', { email: bindEmail.trim(), emailCode: bindEmailCode.trim() });
      await refreshUser?.();
      setBindMsg('✓ 邮箱绑定成功');
      setTimeout(() => { setShowBindEmail(false); router.replace('/profile'); }, 600);
    } catch (e: any) { setBindMsg(e.message); }
    finally { setBindBusy(false); }
  };

  const skipBindEmail = () => {
    setShowBindEmail(false);
    router.replace('/profile');
  };

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (form.password !== form.confirmPassword) { setErr('两次输入的密码不一致'); return; }
    setBusy(true);
    try {
      await register({
        nickname: form.nickname,
        email: '',
        emailCode: '',
        realName: form.realName,
        password: form.password,
        remark: form.remark,
      });
      // 注册成功 → 弹邮箱绑定引导
      setTimeout(() => setShowBindEmail(true), 300);
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  // 已绑定邮箱后直接关弹窗跳个人中心
  useEffect(() => {
    if (me?.email && showBindEmail) {
      setShowBindEmail(false);
      router.replace('/profile');
    }
  }, [me?.email, showBindEmail, router]);

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">注册新账户</h1>
          <p className="text-sm text-slate-500 mt-1">注册您的校园墙账户</p>
        </div>

        {err && <div className="text-sm p-3 rounded-lg mb-4 bg-red-50 text-red-600">{err}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 账号名 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">账号名</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round"/></svg>
              </span>
              <input className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入账号名" value={form.nickname} onChange={e => set('nickname', e.target.value)} required />
            </div>
          </div>

          {/* 真实姓名 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">真实姓名<span className="text-slate-400 text-xs"> (选填)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </span>
              <input className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入您的真实姓名" value={form.realName} onChange={e => set('realName', e.target.value)} />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">密码</label>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round"/></svg>
              </span>
              <input type={showPwd ? 'text' : 'password'} className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入密码" value={form.password} onChange={e => set('password', e.target.value)} required />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* 确认密码 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">确认密码</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round"/></svg>
              </span>
              <input type={showPwd2 ? 'text' : 'password'} className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请再次输入密码" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required />
              <button type="button" onClick={() => setShowPwd2(!showPwd2)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPwd2 ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">备注<span className="text-slate-400 text-xs"> (选填)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <input className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="如：我是高三X班成员" value={form.remark} onChange={e => set('remark', e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition">
            {busy ? '注册中…' : '注册'}
          </button>

          <p className="text-center text-xs text-slate-400 mt-3">
            注册即表示同意
            <Link href="/agreement" className="text-blue-500 mx-1">《用户协议》</Link>
            和
            <Link href="/privacy" className="text-blue-500 mx-1">《隐私政策》</Link>
          </p>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          已有账号？<Link href="/login" className="text-blue-500 font-medium">去登录</Link>
        </p>
      </div>

      {/* ====== 注册成功 → 绑定邮箱引导浮窗 ====== */}
      {showBindEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={skipBindEmail}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            {/* 图标 */}
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-3xl">📧</div>
            <h3 className="text-center text-base font-bold text-gray-900">绑定邮箱 (选填)</h3>
            <p className="mt-1 text-center text-xs text-gray-500 leading-relaxed">
              绑定邮箱后可找回密码、接收通知。可稍后在个人中心绑定。
            </p>

            <div className="mt-4 space-y-3">
              {/* 邮箱输入 */}
              <input type="email" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入邮箱" value={bindEmail} onChange={e => { setBindEmail(e.target.value); setBindMsg(''); }} />

              {/* 验证码 */}
              <div className="flex gap-2">
                <input type="text" inputMode="numeric" maxLength={6} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="6位验证码" value={bindEmailCode} onChange={e => { setBindEmailCode(e.target.value.replace(/\D/g, '')); setBindMsg(''); }} />
                <button type="button" onClick={sendBindCode} disabled={sendingBindCode || bindCountdown > 0}
                  className="shrink-0 px-4 rounded-xl bg-blue-500 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-600 transition">
                  {sendingBindCode ? '发送中' : bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
                </button>
              </div>

              {bindMsg && (
                <div className={`text-xs text-center ${bindMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{bindMsg}</div>
              )}

              {/* 按钮 */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={skipBindEmail} disabled={bindBusy}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 disabled:opacity-50">
                  以后再说
                </button>
                <button type="button" onClick={confirmBindEmail} disabled={bindBusy}
                  className="flex-1 py-3 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
                  {bindBusy ? '绑定中…' : '确认绑定'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
