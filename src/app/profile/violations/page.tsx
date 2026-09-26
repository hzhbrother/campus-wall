'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePageRefresh } from '@/lib/use-page-refresh';

interface ViolationRecord {
  id: string;
  type: string;
  reason: string;
  pointsDeducted: number;
  relatedPostId: string | null;
  createdAt: string;
}

interface ChartPoint { date: string; score: number }

const TYPE_LABEL: Record<string, string> = {
  SPAM: '垃圾广告', ABUSE: '辱骂攻击', PORN: '色情低俗',
  ILLEGAL: '违法违规', PLAGIARISM: '抄袭侵权', OTHER: '其他',
};

// SVG 折线图
function ScoreChart({ data }: { data: ChartPoint[] }) {
  const W = 320, H = 160, padL = 36, padR = 12, padT = 16, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  if (data.length === 0) return <div className="text-center text-sm text-gray-400 py-8">暂无数据</div>;

  const max = 100;
  const min = 0;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.score)}`).join(' ');
  const areaPath = `${path} L${x(data.length - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z`;

  // 只显示部分日期标签
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: W }}>
      {/* 网格线 */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#f0f0f0" strokeWidth="1" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#999">{v}</text>
        </g>
      ))}
      {/* 填充区域 */}
      <path d={areaPath} fill="rgba(59,130,246,0.1)" />
      {/* 折线 */}
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* 数据点 */}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.score)} r="2.5" fill="#3b82f6" />
      ))}
      {/* X 轴标签 */}
      {data.map((d, i) => (
        i % labelEvery === 0 && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="#999">{d.date}</text>
        )
      ))}
    </svg>
  );
}

export default function ViolationsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<ViolationRecord[]>([]);
  const [score, setScore] = useState(100);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    api.get<{ items: ViolationRecord[]; score: number; chart: ChartPoint[] }>('/api/violations')
      .then(d => { setRecords(d.items); setScore(d.score); setChart(d.chart); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  usePageRefresh(load, []);
  useEffect(() => { load(); }, []);

  const scoreColor = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : score >= 40 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>

      {/* 诚信分卡片 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">违规记录</h1>
        <div className="mt-4 flex items-end gap-2">
          <span className={`text-4xl font-bold ${scoreColor}`}>{score}</span>
          <span className="mb-1 text-sm text-gray-400">/ 100 诚信分</span>
        </div>
        <p className="mt-1 text-xs text-gray-400">违规扣分, 每周恢复 10 分 (最高 100)</p>
      </div>

      {/* 折线图 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-gray-700">近 30 天诚信分变化</h2>
        {loading ? <div className="py-8 text-center text-sm text-gray-400">加载中…</div> : <ScoreChart data={chart} />}
      </div>

      {/* 违规列表 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">违规记录</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">加载中…</div>
        ) : err ? (
          <div className="py-8 text-center text-red-500">{err}</div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">暂无违规记录, 请继续保持 ☺</div>
        ) : (
          <div className="space-y-3">
            {records.map(v => (
              <div key={v.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-500">{TYPE_LABEL[v.type] || v.type}</span>
                  <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <p className="mt-1.5 text-sm text-gray-700">{v.reason}</p>
                <p className="mt-1 text-xs text-red-500">扣除诚信分: -{v.pointsDeducted}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
