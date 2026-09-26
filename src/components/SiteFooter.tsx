'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import pkg from '../../package.json';

export function SiteFooter() {
  const [siteName, setSiteName] = useState('校园墙');

  useEffect(() => {
    api.get<{ site_name?: string }>('/api/site-config')
      .then(d => { if (d.site_name) setSiteName(d.site_name); })
      .catch(() => {});
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 pb-2 text-center text-xs text-gray-400 select-none">
      © {year} {siteName} · v{pkg.version}
    </footer>
  );
}
