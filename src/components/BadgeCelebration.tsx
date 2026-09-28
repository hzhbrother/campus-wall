'use client';

// 徽章领取礼花动效: 中间徽章大图弹出 + 周围彩带从中心向外炸开
// 纯 CSS 动画, 无第三方库
import { useMemo } from 'react';

interface CelebrationBadge {
  imageUrl: string | null;
  icon: string | null;
  name: string;
  description?: string | null;
}

const CONFETTI_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#facc15', '#fb923c', '#22d3ee'];

export function BadgeCelebration({ badge, onClose }: { badge: CelebrationBadge; onClose: () => void }) {
  // 生成 70 条彩带, 从中心向四周均匀发散
  const confetti = useMemo(() => {
    const count = 70;
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 120 + Math.random() * 280;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + Math.random() * 9,
        delay: Math.random() * 0.08,
        duration: 0.7 + Math.random() * 0.7,
        rot: Math.random() * 720 - 360,
        isCircle: Math.random() > 0.5, // 一半方块一半圆点
      };
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <style>{`
        @keyframes confetti-burst {
          0% { transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--x), var(--y)) rotate(var(--rot)) scale(0.2); opacity: 0; }
        }
        @keyframes badge-pop {
          0% { transform: scale(0.2); opacity: 0; }
          55% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes text-fade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* 彩带层 (在徽章下方向外炸开) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <div
            key={i}
            className={`absolute left-1/2 top-1/2 ${c.isCircle ? 'rounded-full' : 'rounded-sm'}`}
            style={{
              width: c.size,
              height: c.isCircle ? c.size : c.size * 0.55,
              background: c.color,
              // 关键: 用 CSS 变量传递最终位移, 让动画从中心炸开
              ['--x' as any]: `${c.x}px`,
              ['--y' as any]: `${c.y}px`,
              ['--rot' as any]: `${c.rot}deg`,
              animation: `confetti-burst ${c.duration}s ease-out ${c.delay}s forwards`,
              boxShadow: `0 0 6px ${c.color}`,
            }}
          />
        ))}
      </div>

      {/* 中间徽章大图 + 恭喜文案 */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{ animation: 'badge-pop 0.5s cubic-bezier(.2,1.4,.4,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex h-40 w-40 items-center justify-center">
          {badge.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={badge.imageUrl} alt={badge.name} className="h-40 w-40 object-contain drop-shadow-[0_8px_24px_rgba(250,204,21,0.45)]" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center text-7xl">
              {badge.icon || '🏅'}
            </div>
          )}
        </div>
        <div className="mt-5 text-2xl font-extrabold text-white" style={{ animation: 'text-fade 0.5s ease-out 0.3s both' }}>
          🎉 恭喜获得
        </div>
        <div className="mt-1 text-xl font-bold text-amber-300" style={{ animation: 'text-fade 0.5s ease-out 0.45s both' }}>
          {badge.name}
        </div>
        {badge.description && (
          <div className="mt-3 max-w-xs text-center text-sm text-white/70" style={{ animation: 'text-fade 0.5s ease-out 0.6s both' }}>
            {badge.description}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-6 rounded-full bg-white/20 px-6 py-2 text-sm text-white hover:bg-white/30"
          style={{ animation: 'text-fade 0.5s ease-out 0.8s both' }}
        >
          收下啦
        </button>
      </div>
    </div>
  );
}
