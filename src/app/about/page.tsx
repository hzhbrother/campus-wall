'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AboutPage() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, string>>('/api/site-config')
      .then(setCfg)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const siteName = cfg.site_name || '校园墙';
  const siteDesc = cfg.site_desc || '校园信息交流平台';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
        {cfg.site_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.site_logo} alt="" className="mx-auto h-16 w-16 rounded-2xl object-contain mb-3" />
        ) : (
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold mb-3">
            {siteName[0]}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
        <p className="text-sm text-gray-500 mt-1">{siteDesc}</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3 text-sm text-gray-700">
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">关于我们</h2>
          <p className="leading-relaxed">
            {siteName} 是一个面向校园的信息交流平台，致力于为同学们提供失物招领、二手交易、表白墙、寻物启事、招聘兼职等便捷的信息服务。
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">主要功能</h2>
          <ul className="list-disc pl-5 space-y-1 leading-relaxed">
            <li>发布与浏览校园各类信息</li>
            <li>失物招领与寻物启事</li>
            <li>二手交易市场</li>
            <li>匿名表白墙</li>
            <li>招聘兼职信息</li>
            <li>评论互动与点赞</li>
          </ul>
        </div>
        {cfg.contact_email && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">联系我们</h2>
            <p>邮箱：{cfg.contact_email}</p>
          </div>
        )}
        {cfg.site_icp && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">备案信息</h2>
            <p>{cfg.site_icp}</p>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-400 py-2">
        © {new Date().getFullYear()} {siteName}
      </div>
    </div>
  );
}
