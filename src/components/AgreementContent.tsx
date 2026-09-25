'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AgreementContentProps {
  type: 'agreement' | 'privacy';
  title: string;
  defaultContent: string;
}

export default function AgreementContent({ type, title, defaultContent }: AgreementContentProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, string>>('/api/site-config')
      .then(d => {
        const key = type === 'agreement' ? 'agreement_content' : 'privacy_content';
        setContent(d[key] || defaultContent);
      })
      .catch(() => setContent(defaultContent))
      .finally(() => setLoading(false));
  }, [type, defaultContent]);

  return (
    <div className="space-y-4">
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
