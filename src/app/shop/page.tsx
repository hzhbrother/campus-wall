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
    if (!user) {
      setMsg('请先登录');
      return;
    }
    if (item.stock === 0) {
      setMsg('该商品已兑完');
      return;
    }
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
    <div className="space-y-4 -mx-4">
      <div className="px-4 pt-1">
        <h1 className="text-xl font-bold text-gray-900">积分商城</h1>
        {user && <p className="text-sm text-gray-500 mt-1">当前积分: <span className="font-semibold text-amber-600">{user.points || 0}</span></p>}
      </div>

      {msg && <div className={`px-4 text-sm ${msg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{msg}</div>}

      {loading ? (
        <p className="text-center text-gray-400 py-8">加载中…</p>
      ) : items.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-400">
          <p className="text-4xl mb-2">🛍️</p>
          <p className="text-sm">暂无商品</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4">
          {items.map(item => (
            <div key={item.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl">🎁</span>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{item.name}</h3>
                {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-amber-600 font-bold text-sm">🪙 {item.pointsCost}</span>
                  <button
                    onClick={() => exchange(item)}
                    disabled={exchanging === item.id || item.stock === 0}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {item.stock === 0 ? '已兑完' : exchanging === item.id ? '兑换中' : '兑换'}
                  </button>
                </div>
                {item.stock > 0 && item.stock < 999 && (
                  <p className="text-xs text-gray-400 mt-1">库存: {item.stock}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
