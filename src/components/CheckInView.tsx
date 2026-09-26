'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function CheckInView({ onBack }: { onBack: () => void }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newBadge, setNewBadge] = useState<{ name: string; icon?: string | null } | null>(null);

  const load = useCallback(() => {
    api.get<{ checkedIn: boolean; streak: number; points: number }>('/api/users/me/checkin')
      .then(d => { setCheckedIn(d.checkedIn); setStreak(d.streak); setPoints(d.points); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const doCheckIn = async () => {
    if (checkedIn || busy) return;
    setBusy(true); setMsg('');
    try {
      const res: any = await api.post('/api/users/me/checkin', {});
      setCheckedIn(true);
      setStreak(res.streak);
      setPoints(res.points);
      setMsg(`签到成功! 获得 ${res.points} 积分`);
      if (res.newBadges && res.newBadges.length > 0) {
        setNewBadge(res.newBadges[0]);
      }
    } catch (e: any) {
      setMsg(e.message || '签到失败');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 shadow-sm text-white text-center">
        <div className="text-5xl mb-2">🪙</div>
        <div className="text-3xl font-bold">{points}</div>
        <div className="text-sm text-white/80">我的积分</div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm">
          🔥 连续签到 {streak} 天
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm text-center">
        <button
          onClick={doCheckIn}
          disabled={checkedIn || busy}
          className={`w-full rounded-full py-4 text-base font-medium transition ${
            checkedIn ? 'bg-gray-100 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'
          }`}
        >
          {checkedIn ? '✅ 今日已签到' : busy ? '签到中…' : '立即签到'}
        </button>
        <p className="mt-3 text-xs text-gray-400">连续签到 7 天及以上可获得 2 积分/天</p>
        {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
      </div>

      {/* 勋章获得弹窗 (撒礼花) */}
      {newBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setNewBadge(null)}>
          <div className="text-center" onClick={e => e.stopPropagation()}>
            <div className="text-7xl mb-4 animate-bounce">{newBadge.icon || '🏅'}</div>
            <div className="text-2xl font-bold text-white mb-2">🎉 恭喜获得新勋章</div>
            <div className="text-xl text-amber-300 font-bold">{newBadge.name}</div>
            <p className="mt-4 text-sm text-white/60">点击空白处关闭</p>
          </div>
          {/* 礼花效果 */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                className="absolute text-2xl animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}
              >
                {['🎉', '🎊', '✨', '⭐', '🌟'][i % 5]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
