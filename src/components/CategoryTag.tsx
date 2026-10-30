'use client';

import { getCategoryColor } from '@/lib/category-colors';
import { useCategoryColors } from '@/lib/use-category-colors';

/** 帖子分类标签 (颜色由管理员配置) */
export function CategoryTag({ category, className = '' }: { category: string; className?: string }) {
  const colors = useCategoryColors();
  const hex = getCategoryColor(category, colors);
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium text-white ${className}`}
      style={{ backgroundColor: hex }}
    >
      #{category}
    </span>
  );
}
