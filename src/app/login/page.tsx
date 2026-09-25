'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

// OAuth 入口走同源 /api/auth/oauth/:provider (Vercel 部署后同源)
const OAUTH_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email, password);
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
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">登录</h1>
      {err && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-3 card p-5">
        <input className="input" type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn-primary w-full" disabled={busy}>{busy ? '登录中…' : '登录'}</button>
      </form>

      <div className="text-center text-xs text-slate-400 my-4">— 第三方登录 —</div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={() => oauth('github')}>GitHub 登录</button>
        <button className="btn-ghost" onClick={() => oauth('google')}>Google 登录</button>
        <button className="btn-ghost" onClick={() => oauth('wechat')}>微信登录</button>
        <button className="btn-ghost" onClick={() => oauth('qq')}>QQ 登录</button>
        <button className="btn-ghost col-span-2" onClick={() => oauth('weibo')}>微博登录</button>
      </div>
      <p className="text-center text-sm text-slate-500 mt-4">
        没有账号? <Link href="/register">去注册</Link>
      </p>
      <p className="text-center text-xs text-slate-400 mt-2">
        第三方登录需服务端配置对应凭据, 未配置时会提示。
      </p>
    </div>
  );
}
