'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePageRefresh } from '@/lib/use-page-refresh';

interface AgreementContentProps {
  type: 'agreement' | 'privacy';
  title: string;
  defaultContent: string;
}

export default function AgreementContent({ type, title, defaultContent }: AgreementContentProps) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get<Record<string, string>>('/api/site-config')
      .then(d => {
        const key = type === 'agreement' ? 'agreement_content' : 'privacy_content';
        setContent(d[key] || defaultContent);
      })
      .catch(() => setContent(defaultContent))
      .finally(() => setLoading(false));
  };
  usePageRefresh(load, [type, defaultContent]);
  useEffect(() => { load(); }, [type, defaultContent]);

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        返回
      </button>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
        <p className="text-xs text-gray-400 mb-4">最后更新：{new Date().toLocaleDateString('zh-CN')}</p>
        {loading ? (
          <p className="py-8 text-center text-gray-400">加载中…</p>
        ) : (
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
