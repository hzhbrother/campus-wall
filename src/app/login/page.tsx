'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const OAUTH_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(account, password);
      router.push('/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const oauth = (provider: string) => {
    window.location.href = `${OAUTH_BASE}/api/auth/oauth/${provider}`;
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">欢迎回来</h1>
          <p className="text-sm text-slate-500 mt-1">登录您的校园墙账户</p>
        </div>

        {err && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{err}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 账号名 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">账号名</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round"/></svg>
              </span>
              <input
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入账号名"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">密码</label>
              <span className="text-xs text-blue-500 cursor-pointer">忘记密码？</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round"/></svg>
              </span>
              <input
                type={showPwd ? 'text' : 'password'}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPwd ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22" strokeLinecap="round"/></svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition">
            {busy ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          没有账号？<Link href="/register" className="text-blue-500 font-medium">立即注册</Link>
        </p>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">或</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* 第三方登录 */}
        <div className="flex justify-center gap-4">
          {[
            { key: 'github', label: 'GitHub', icon: '🐙' },
            { key: 'google', label: 'Google', icon: '🔍' },
            { key: 'wechat', label: '微信', icon: '💬' },
            { key: 'qq', label: 'QQ', icon: '🐧' },
          ].map(p => (
            <button key={p.key} onClick={() => oauth(p.key)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600" title={p.label}>
              <span className="text-2xl">{p.icon}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
