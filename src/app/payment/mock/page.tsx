'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function MockInner() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get('orderId') || '';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!orderId) return <p className="text-red-500 text-center py-16">缺少订单号</p>;

  const pay = async () => {
    setBusy(true); setErr('');
    try {
      await api.post(`/api/payment/mock/pay/${orderId}`);
      router.push(`/payment/result?orderId=${orderId}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto card p-8 text-center mt-6">
      <div className="text-5xl mb-3">💳</div>
      <h1 className="text-xl font-bold mb-2">模拟支付</h1>
      <p className="text-sm text-slate-500 mb-1">订单号: {orderId}</p>
      <p className="text-xs text-slate-400 mb-6">这是 Mock 支付通道, 点击下方按钮即视为支付成功。真实渠道请配置支付宝/微信支付。</p>
      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}
      <button className="btn-primary w-full" onClick={pay} disabled={busy}>{busy ? '处理中…' : '确认支付'}</button>
      <button className="btn-ghost w-full mt-2" onClick={() => router.push('/profile')}>取消</button>
    </div>
  );
}

export default function MockPayPage() {
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-16">加载中…</p>}>
      <MockInner />
    </Suspense>
  );
}
