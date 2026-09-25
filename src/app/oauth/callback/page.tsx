'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { applyToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const err = params.get('error');
    if (err) { setError(err); return; }
    if (!token) { setError('未收到登录凭据'); return; }
    applyToken(token).then(() => router.push('/'));
  }, [params, applyToken, router]);

  return (
    <div className="text-center py-16">
      {error ? (
        <div className="space-y-4">
          <p className="text-red-500">登录失败: {decodeURIComponent(error)}</p>
          <a href="/login" className="btn-primary no-underline">返回登录</a>
        </div>
      ) : (
        <p className="text-slate-500">登录中, 请稍候…</p>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-16">加载中…</p>}>
      <CallbackInner />
    </Suspense>
  );
}
