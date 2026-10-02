'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  pointsCost: number;
  stock: number;
}

export default function ShopPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<{ items: ShopItem[] }>('/api/shop/items')
      .then(d => setItems(d.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const exchange = async (item: ShopItem) => {
    if (!user) { setMsg('请先登录'); return; }
    if (item.stock === 0) { setMsg('该商品已兑完'); return; }
    if (!confirm(`确定使用 ${item.pointsCost} 积分兑换「${item.name}」吗?`)) return;
    setExchanging(item.id); setMsg('');
    try {
      await api.post('/api/shop/exchange', { itemId: item.id });
      setMsg('兑换成功! 请等待管理员发放');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock > 0 ? i.stock - 1 : 0 } : i));
    } catch (e: any) {
      setMsg(e?.message || '兑换失败');
    } finally { setExchanging(null); }
  };

  return (
    <div className="-mx-4">
      {/* 顶部渐变横幅 */}
      <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 px-4 pt-4 pb-8">
        <h1 className="text-2xl font-bold text-white">积分商城</h1>
        <p className="text-amber-50 text-sm mt-1">用积分兑换你喜欢的好物</p>
        {user && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2">
            <span className="text-lg">🪙</span>
            <span className="text-white font-semibold">{user.points || 0}</span>
            <span className="text-amber-100 text-xs">积分</span>
          </div>
        )}
      </div>

      {msg && (
        <div className={`mx-4 -mt-4 rounded-xl px-4 py-3 text-sm shadow-sm ${msg.includes('成功') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          {msg}
        </div>
      )}

      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
            <p className="mt-3 text-sm text-gray-400">加载中…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🛍️</div>
            <p className="text-sm">暂无商品, 敬请期待</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
              <div key={item.id} className="group rounded-2xl bg-white shadow-sm overflow-hidden transition hover:shadow-md">
                <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <span className="text-5xl opacity-60">🎁</span>
                  )}
                  {/* 库存标签 */}
                  {item.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">已兑完</span>
                    </div>
                  )}
                  {item.stock > 0 && item.stock < 10 && (
                    <span className="absolute top-2 right-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white">仅剩{item.stock}件</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{item.name}</h3>
                  {item.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>}
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-amber-500 text-xs">🪙</span>
                      <span className="text-amber-600 font-bold text-base">{item.pointsCost}</span>
                    </div>
                    <button
                      onClick={() => exchange(item)}
                      disabled={exchanging === item.id || item.stock === 0}
                      className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-amber-500/20 hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {exchanging === item.id ? '兑换中' : '立即兑换'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
