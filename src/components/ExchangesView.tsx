'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const FULFILLMENT_LABELS: Record<string, string> = {
  SELF_PICKUP: '线下自提',
  EXPRESS: '快递邮寄',
  VIRTUAL_CODE: '虚拟兑换码',
  ONLINE: '线上发放',
  CONTACT: '联系管理员',
  OTHER: '其他',
};

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待发放', color: 'bg-amber-100 text-amber-700' },
  FULFILLED: { text: '已发放', color: 'bg-green-100 text-green-700' },
  CANCELLED: { text: '已取消', color: 'bg-gray-100 text-gray-500' },
};

export function ExchangesView({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  const load = () => {
    api.get<{ items: any[] }>('/api/shop/exchanges/me')
      .then(d => setRecords(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const statusOf = (s: string) => STATUS_LABELS[s] || STATUS_LABELS.PENDING;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>

      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
        <h1 className="text-xl font-bold">我的兑换</h1>
        <p className="text-sm opacity-90 mt-1">查看积分兑换记录与发放状态</p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-gray-400">加载中…</p>
      ) : records.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-10 text-center text-gray-400">
          <div className="text-4xl mb-2">🎁</div>
          <p className="text-sm">还没有兑换记录</p>
          <p className="text-xs mt-1">去「积分商城」兑换喜欢的物品吧~</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const st = statusOf(r.status);
            return (
              <div key={r.id} className="rounded-2xl bg-white shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-amber-50 overflow-hidden flex items-center justify-center shrink-0">
                    {r.item?.image ? <img src={r.item.image} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">🎁</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{r.item?.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st.color}`}>{st.text}</span>
                    </div>
                    <p className="text-sm text-amber-600 font-medium mt-0.5">{r.pointsCost} 积分</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  {r.status === 'FULFILLED' && (
                    <button onClick={() => setDetail(r)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 shrink-0">
                      查看发放
                    </button>
                  )}
                </div>
                {r.status === 'FULFILLED' && r.fulfillmentType && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                    <span className="text-gray-500">发放方式: </span>
                    <span className="font-medium text-gray-700">{FULFILLMENT_LABELS[r.fulfillmentType] || '其他'}</span>
                    {r.fulfilledAt && (
                      <span className="text-gray-400 ml-2">· {new Date(r.fulfilledAt).toLocaleString('zh-CN')}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detail && <FulfillDetailDialog record={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function FulfillDetailDialog({ record, onClose }: { record: any; onClose: () => void }) {
  let info: Record<string, string> = {};
  try { info = record.fulfillmentInfo ? JSON.parse(record.fulfillmentInfo) : {}; } catch {}
  const hasInfo = Object.values(info).some(v => v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-500">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">兑换已发放</h3>
            <p className="text-xs text-gray-500">{record.item?.name}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm rounded-xl bg-gray-50 p-4">
          <div className="flex justify-between"><span className="text-gray-500">发放方式</span><span className="font-medium">{FULFILLMENT_LABELS[record.fulfillmentType] || '其他'}</span></div>
          {record.fulfilledAt && <div className="flex justify-between"><span className="text-gray-500">发放时间</span><span>{new Date(record.fulfilledAt).toLocaleString('zh-CN')}</span></div>}
          {hasInfo && (
            <div className="pt-2 mt-2 border-t border-gray-200 space-y-1.5">
              {Object.entries(info).filter(([_, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">{k}</span><span className="text-right break-all font-medium">{v}</span></div>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600">我知道了</button>
      </div>
    </div>
  );
}
