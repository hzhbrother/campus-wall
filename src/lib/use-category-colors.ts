'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { parseCategoryColors } from '@/lib/category-colors';

let cache: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;

function loadColors(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api.get<Record<string, string>>('/api/site-config')
      .then(cfg => {
        cache = parseCategoryColors(cfg.post_category_colors);
        return cache;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return pending;
}

/** 获取管理员配置的分类颜色; 全局只请求一次并缓存 */
export function useCategoryColors() {
  const [colors, setColors] = useState<Record<string, string>>(cache || {});
  useEffect(() => {
    let alive = true;
    loadColors().then(c => { if (alive) setColors(c); });
    return () => { alive = false; };
  }, []);
  return colors;
}
