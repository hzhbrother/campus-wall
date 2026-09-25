'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function ResultInner() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get('orderId') || '';
  const [order, setOrder] = useState<any | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!orderId) { setErr('缺少订单号'); return; }
    api.get(`/api/payment/orders/${orderId}`)
      .then(setOrder)
      .catch((e) => setErr(e.message));
  }, [orderId]);

  if (err) return <p className="text-red-500 text-center py-16">{err}</p>;
  if (!order) return <p className="text-center text-slate-400 py-16">加载中…</p>;

  const paid = order.status === 'PAID';
  return (
    <div className="max-w-md mx-auto card p-8 text-center mt-6">
      <div className="text-5xl mb-3">{paid ? '✅' : '⏳'}</div>
      <h1 className="text-xl font-bold mb-2">{paid ? '支付成功' : '支付未完成'}</h1>
      <div className="text-sm text-slate-500 space-y-1 my-4">
        <div>商品: {order.subject}</div>
        <div>金额: ¥{(order.amount / 100).toFixed(2)}</div>
        <div>状态: {order.status}</div>
      </div>
      <button className="btn-primary w-full" onClick={() => router.push('/profile')}>查看我的订单</button>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<p className="text-center text-slate-400 py-16">加载中…</p>}>
      <ResultInner />
    </Suspense>
  );
}
