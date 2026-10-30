'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const { register } = useAuth();
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
      // 本次会话内不弹邮箱绑定提示, 下次打开网站时再提示
      try { sessionStorage.setItem('email_prompt_skip_session', '1'); } catch {}
      router.replace('/');
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

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

          {/* 真实姓名 (选填) */}
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
    </div>
  );
}
