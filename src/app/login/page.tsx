'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { JUHE_TYPES } from '@/lib/aggregated-login';
import { BrandIcon } from '@/components/BrandIcons';

const OAUTH_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function LoginPage() {
  const { login, user, loading, savedAccounts, switchAccount } = useAuth();
  const router = useRouter();
  // add=1 表示从「添加账号」入口进入, 已登录也不自动跳转, 让用户继续登录新账号
  const [isAddAccount, setIsAddAccount] = useState(false);
  useEffect(() => {
    setIsAddAccount(new URLSearchParams(window.location.search).get('add') === '1');
  }, []);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [switchBusy, setSwitchBusy] = useState<string | null>(null);
  const [showAggregated, setShowAggregated] = useState(false);
  const [juheReady, setJuheReady] = useState(false);
  const [openTypes, setOpenTypes] = useState<string[]>([]);

  // 已登录则跳转首页 (add=1 时不跳, 让用户添加新账号)
  useEffect(() => {
    if (!loading && user && !isAddAccount) router.replace('/');
  }, [user, loading, router, isAddAccount]);

  // 检测聚合登录是否可用 + 获取开放的登录方式
  useEffect(() => {
    api.get('/api/auth/aggregated/status').then((d: any) => setJuheReady(d.configured)).catch(() => setJuheReady(false));
    api.get('/api/site-config').then((d: any) => {
      const types = d.open_login_types;
      if (types) setOpenTypes(types.split(',').filter(Boolean));
    }).catch(() => setOpenTypes([]));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(account, password);
      router.replace('/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startAggregated = (type: string) => {
    setShowAggregated(false);
    window.location.href = `${OAUTH_BASE}/api/auth/oauth/aggregated/${type}`;
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

        {/* 已保存账号: 一键登录 */}
        {savedAccounts.length > 0 && (
          <div className="mb-6">
            <div className="text-xs text-slate-400 mb-2">点击直接登录已保存的账号</div>
            <div className="space-y-2">
              {savedAccounts.map(acc => (
                <button
                  key={acc.userId}
                  type="button"
                  disabled={switchBusy !== null}
                  onClick={async () => {
                    setErr(''); setSwitchBusy(acc.userId);
                    try {
                      await switchAccount(acc.userId);
                      router.replace('/');
                    } catch (e: any) {
                      setErr(e.message || '登录已过期, 请重新输入密码登录');
                    } finally {
                      setSwitchBusy(null);
                    }
                  }}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                    {acc.avatar ? <img src={acc.avatar} alt="" className="h-full w-full object-cover" /> : (acc.nickname || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{acc.nickname}</div>
                    <div className="text-xs text-slate-400">{acc.role === 'SUPER_ADMIN' ? '超级管理员' : acc.role === 'ADMIN' ? '管理员' : '用户'}</div>
                  </div>
                  <span className="text-xs text-blue-500 font-medium">
                    {switchBusy === acc.userId ? '登录中…' : '一键登录'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 账号名 / 手机号 / 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">账号</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round"/></svg>
              </span>
              <input
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="账号名 / 手机号 / 邮箱"
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
              <span className="text-xs text-blue-500 cursor-pointer" onClick={() => router.push('/forgot-password')}>忘记密码？</span>
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

        {/* 聚合登录 */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowAggregated(true)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            第三方快捷登录
          </button>
        </div>
      </div>

      {/* 聚合登录选择面板 */}
      {showAggregated && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowAggregated(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <h3 className="mb-1 text-center text-lg font-bold text-slate-900">选择登录方式</h3>
            <p className="mb-5 text-center text-xs text-slate-400">
              {juheReady ? '通过彩虹云一键授权登录' : '聚合登录暂未配置, 请联系管理员'}
            </p>
            <div className="grid grid-cols-5 gap-3">
              {(openTypes.length > 0 ? JUHE_TYPES.filter(p => openTypes.includes(p.type)) : JUHE_TYPES).map(p => (
                <button
                  key={p.type}
                  disabled={!juheReady}
                  onClick={() => startAggregated(p.type)}
                  className="flex flex-col items-center gap-2 rounded-2xl py-3 transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 shadow-sm ring-1 ring-slate-100">
                    <BrandIcon type={p.type} size={26} />
                  </span>
                  <span className="text-xs font-medium text-slate-600">{p.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAggregated(false)}
              className="mt-6 w-full rounded-xl bg-slate-100 py-3 text-sm text-slate-600"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
