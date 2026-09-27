'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface School { id: string; name: string; stage?: string | null; }
interface Org { id: string; name: string; }

interface Props {
  onClose: () => void;
  onJoined: () => void;
}

export function JoinOrgModal({ onClose, onJoined }: Props) {
  const [tab, setTab] = useState<'school' | 'org'>('school');
  const [schools, setSchools] = useState<School[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ items: School[] }>('/api/schools').then(d => d.items || []).catch(() => []),
      api.get<{ items: Org[] }>('/api/orgs').then(d => d.items || []).catch(() => []),
    ]).then(([s, o]) => {
      setSchools(s);
      setOrgs(o);
      setLoading(false);
    });
  }, []);

  const join = async () => {
    if (!selected) { setErr('请选择要加入的学校或团体'); return; }
    setBusy(true); setErr('');
    try {
      const payload: any = tab === 'school'
        ? { schoolId: selected }
        : { organizationId: selected };
      await api.patch('/api/users/me', payload);
      onJoined();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const list = tab === 'school' ? schools : orgs;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-bold text-gray-900">加入学校 / 团体</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <p className="mb-3 text-sm text-gray-500">
            选择您所属的学校或团体, 加入后将显示在个人主页。也可跳过, 之后在「认证」中设置。
          </p>

          {/* 切换: 学校 / 团体 */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => { setTab('school'); setSelected(null); }}
              className={`rounded-lg py-2.5 text-sm font-medium ${tab === 'school' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              🏫 学校
            </button>
            <button
              onClick={() => { setTab('org'); setSelected(null); }}
              className={`rounded-lg py-2.5 text-sm font-medium ${tab === 'org' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              👥 团体
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-400">加载中…</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <div className="text-4xl mb-2">{tab === 'school' ? '🏫' : '👥'}</div>
              <p className="text-sm">暂无{tab === 'school' ? '学校' : '团体'}可加入</p>
              <p className="text-xs mt-1">请联系管理员添加</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selected === item.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                    {tab === 'school' && (item as School).stage && (
                      <div className="mt-0.5 text-xs text-gray-400">{(item as School).stage}</div>
                    )}
                  </div>
                  <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected === item.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {selected === item.id && <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {err && <p className="mt-3 text-center text-sm text-red-500">{err}</p>}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-gray-100 px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            跳过
          </button>
          <button
            onClick={join}
            disabled={busy || !selected}
            className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {busy ? '提交中…' : '加入'}
          </button>
        </div>
      </div>
    </div>
  );
}
