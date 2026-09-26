'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';
import { usePageRefresh } from '@/lib/use-page-refresh';

interface BanRecord {
  id: string;
  reason: string;
  durationDays: number;
  durationHours?: number;
  bannedUntil: string | null;
  isPermanent: boolean;
  createdAt: string;
  liftedAt: string | null;
  liftedReason: string | null;
  appeals: { id: string; status: string; createdAt: string }[];
}

export default function BanAppealPage() {
  const router = useRouter();
  const [records, setRecords] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [appealingId, setAppealingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.get<{ items: BanRecord[] }>('/api/ban-records')
      .then(d => setRecords(d.items))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  usePageRefresh(load, []);
  useEffect(() => { load(); }, []);

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const compressed: string[] = [];
    for (const f of files.slice(0, 6 - images.length)) {
      try { compressed.push(await compressImage(f)); } catch {}
    }
    setImages(prev => [...prev, ...compressed]);
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const submit = async (recordId: string) => {
    if (!reason.trim()) { setMsg('请填写申诉原因'); return; }
    if (!content.trim()) { setMsg('请填写申诉内容'); return; }
    setSubmitting(true); setMsg('');
    try {
      await api.post('/api/ban-appeals', { banRecordId: recordId, reason: reason.trim(), content: content.trim(), images });
      setMsg('申诉已提交, 请等待审核');
      setAppealingId(null);
      setReason(''); setContent(''); setImages([]);
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setSubmitting(false); }
  };

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('zh-CN') : '-';

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">封禁申诉</h1>
        <p className="mt-1 text-sm text-gray-500">查看封禁记录并提交申诉</p>
      </div>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.includes('成功') || msg.includes('已提交') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{msg}</p>}

      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中…</div>
      ) : err ? (
        <div className="py-12 text-center text-red-500">{err}</div>
      ) : records.length === 0 ? (
        <div className="py-16 text-center text-gray-400">暂无封禁记录</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const isActive = !r.liftedAt && (r.isPermanent || (r.bannedUntil && new Date(r.bannedUntil) > new Date()));
            const hasPendingAppeal = r.appeals.some(a => a.status === 'PENDING');
            return (
              <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                    {isActive ? '封禁中' : r.liftedAt ? '已解封' : '已到期'}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  <div><span className="text-gray-400">封禁类型: </span>{r.isPermanent ? '永久封禁' : `临时封禁 ${r.durationDays} 天${r.durationHours ? ' ' + r.durationHours + ' 小时' : ''}`}</div>
                  <div><span className="text-gray-400">封禁原因: </span>{r.reason || '未填写'}</div>
                  <div><span className="text-gray-400">到期时间: </span>{r.isPermanent ? '永久' : fmtDate(r.bannedUntil)}</div>
                  {r.liftedAt && <div><span className="text-gray-400">解封时间: </span>{fmtDate(r.liftedAt)} ({r.liftedReason || ''})</div>}
                </div>
                {hasPendingAppeal && (
                  <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-600">您的申诉正在审核中…</div>
                )}
                {appealingId === r.id ? (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                    <input
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="申诉原因 (如: 内容被误判)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      maxLength={100}
                    />
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="详细说明申诉理由…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      rows={4}
                      maxLength={1000}
                    />
                    {/* 图片上传 */}
                    <div className="flex flex-wrap gap-2">
                      {images.map((src, i) => (
                        <div key={i} className="relative h-20 w-20">
                          <img src={src} alt="" className="h-full w-full rounded-lg object-cover" />
                          <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs">✕</button>
                        </div>
                      ))}
                      {images.length < 6 && (
                        <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-400">
                          +
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => submit(r.id)} disabled={submitting} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white disabled:opacity-50">{submitting ? '提交中…' : '提交申诉'}</button>
                      <button onClick={() => { setAppealingId(null); setReason(''); setContent(''); setImages([]); }} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm text-gray-700">取消</button>
                    </div>
                  </div>
                ) : (
                  isActive && !hasPendingAppeal && (
                    <button onClick={() => setAppealingId(r.id)} className="mt-3 w-full rounded-lg bg-blue-50 py-2 text-sm text-blue-600 hover:bg-blue-100">
                      申诉
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
