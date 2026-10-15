'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const PROVIDER_LABELS: Record<string, string> = {
  WECHAT: '微信',
  QQ: 'QQ',
  WEIBO: '微博',
  GITHUB: 'GitHub',
  GOOGLE: 'Google',
};

function BindInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { applyToken } = useAuth();

  const bindToken = params.get('bind_token') || '';
  const [provider, setProvider] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bindToken) return;
    try {
      const payload = JSON.parse(Buffer.from(bindToken.split('.')[1], 'base64').toString());
      setProvider(payload.provider || '');
      setNickname(payload.nickname || '');
      setAvatar(payload.avatar || '');
    } catch {
      setErr('绑定信息解析失败, 请重新授权');
    }
  }, [bindToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !password) { setErr('请输入账号和密码'); return; }
    setBusy(true);
    setErr('');
    try {
      const res = await api.post<{ token: string; user: any }>('/api/auth/bind/confirm', {
        bindToken,
        account,
        password,
      });
      await applyToken(res.token);
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message || '绑定失败');
    } finally {
      setBusy(false);
    }
  };

  if (!bindToken) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500">绑定信息缺失, 请重新从第三方登录入口进入</p>
        <a href="/login" className="btn-primary no-underline inline-block mt-4">返回登录</a>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">账号绑定</h1>
          <p className="text-sm text-slate-500 mt-1">将第三方账号绑定到已有账号</p>
        </div>

        {/* 第三方账号信息 */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-slate-400 text-lg">{nickname?.[0] || '?'}</span>
            )}
          </div>
          <div>
            <div className="text-sm text-slate-500">{PROVIDER_LABELS[provider] || provider} 账号</div>
            <div className="font-medium text-slate-900">{nickname || '未知用户'}</div>
          </div>
        </div>

        {err && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">账号</label>
            <input
              type="text"
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder="手机号 / 邮箱 / 昵称"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="input w-full"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? '绑定中…' : '确认绑定'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-slate-500">
          还没有账号？
          <a href="/register" className="text-blue-600 hover:underline ml-1">立即注册</a>
        </div>
      </div>
    </div>
  );
}

export default function OAuthBindPage() {
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-16">加载中…</p>}>
      <BindInner />
    </Suspense>
  );
}
