'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

// 奖励规则: 显示在签到页下方 (积分梯度 + 勋章里程碑)
const REWARD_RULES = [
  // 积分梯度
  { days: 1,    text: '每日签到 +1 积分',          isBadge: false },
  { days: 3,    text: '连续 3 天起, +2 积分/天',    isBadge: false },
  { days: 7,    text: '连续 7 天起, +3 积分/天',    isBadge: false },
  { days: 15,   text: '连续 15 天起, +5 积分/天',   isBadge: false },
  { days: 30,   text: '连续 30 天起, +8 积分/天',   isBadge: false },
  { days: 100,  text: '连续 100 天起, +12 积分/天', isBadge: false },
  // 勋章里程碑
  { days: 7,    text: '连续 7 天: 「签到新手」勋章',  isBadge: true },
  { days: 30,   text: '连续 30 天: 「签到达人」勋章', isBadge: true },
  { days: 100,  text: '连续 100 天: 「签到狂魔」勋章', isBadge: true },
  { days: 365,  text: '连续 365 天: 「签到之神」勋章', isBadge: true },
];

export function CheckInView({ onBack, onPointsChanged }: { onBack: () => void; onPointsChanged?: () => void }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [today, setToday] = useState('');              // 北京时间今日 YYYY-MM-DD
  const [monthSignedDays, setMonthSignedDays] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newBadge, setNewBadge] = useState<{ name: string; icon?: string | null } | null>(null);

  const load = useCallback(() => {
    api.get<{ checkedIn: boolean; streak: number; points: number; today: string; monthSignedDays: string[] }>('/api/users/me/checkin')
      .then(d => {
        setCheckedIn(d.checkedIn);
        setStreak(d.streak);
        setPoints(d.points);
        setToday(d.today);
        setMonthSignedDays(d.monthSignedDays || []);
      })
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
      // 签到后把今天加进 monthSignedDays, 立即高亮
      if (today) setMonthSignedDays(prev => Array.from(new Set([...prev, today])));
      if (res.newBadges && res.newBadges.length > 0) {
        setNewBadge(res.newBadges[0]);
      }
      onPointsChanged?.();
    } catch (e: any) {
      setMsg(e.message || '签到失败');
    } finally { setBusy(false); }
  };

  // ---- 日历渲染 ----
  // 用 today (北京今日) 锚定展示月份, 没拿到则用本地 Date 兜底
  const monthAnchor = useMemo(() => {
    if (today) {
      const [y, m] = today.split('-').map(Number);
      return { year: y, month: m };
    }
    const now = new Date();
    const cnNow = new Date(now.getTime() + 8 * 3600 * 1000);
    return { year: cnNow.getUTCFullYear(), month: cnNow.getUTCMonth() + 1 };
  }, [today]);

  const calendarCells = useMemo(() => {
    const { year, month } = monthAnchor;
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = firstDay.getUTCDay();                // 0=日 ... 6=六
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const todayDay = today ? Number(today.slice(8, 10)) : null;

    const cells: Array<{ day: number | null; dateStr?: string; isToday?: boolean; signed?: boolean }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const ds = `${year}-${mm}-${dd}`;
      cells.push({
        day: d,
        dateStr: ds,
        isToday: d === todayDay,
        signed: monthSignedDays.includes(ds),
      });
    }
    return cells;
  }, [monthAnchor, monthSignedDays, today]);

  const monthLabel = `${monthAnchor.year}年${monthAnchor.month}月`;

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

      {/* 签到日历 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 text-center text-sm font-medium text-gray-700">{monthLabel} 签到日历</div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
          {['日','一','二','三','四','五','六'].map(w => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarCells.map((c, i) => {
            if (c.day == null) return <div key={i} className="aspect-square" />;
            if (c.signed) {
              // 已签到: 实心圆 + 底色 + 勾
              return (
                <div key={i} className="aspect-square flex items-center justify-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white text-sm font-medium shadow-sm">
                    ✓
                  </div>
                </div>
              );
            }
            // 未签到: 灰色数字 (不加圈底色)
            return (
              <div key={i} className="aspect-square flex items-center justify-center">
                <div className={`flex h-9 w-9 items-center justify-center text-sm ${c.isToday ? 'text-blue-500 font-bold ring-1 ring-blue-300 rounded-full' : 'text-gray-400'}`}>
                  {c.day}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-blue-500" />已签到</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-gray-200" />未签到</span>
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
        {msg && <p className="mt-2 text-sm text-green-600">{msg}</p>}
      </div>

      {/* 奖励规则列表 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-medium text-gray-700">连续签到奖励</div>
        <ul className="space-y-2.5 text-sm">
          {REWARD_RULES.map((r, i) => {
            const achieved = streak >= r.days;
            return (
              <li key={i} className="flex items-center justify-between">
                <span className={`flex items-center gap-2 ${achieved ? 'text-gray-400' : 'text-gray-700'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${achieved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                    {r.isBadge ? '🏅' : r.days}
                  </span>
                  <span className={achieved ? 'line-through' : ''}>{r.text}</span>
                </span>
                {achieved && <span className="text-xs text-green-500">已达成</span>}
              </li>
            );
          })}
        </ul>
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
