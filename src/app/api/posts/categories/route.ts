// GET /api/posts/categories  分类目录 (含审核标记, 从站点配置读取)
import { NextResponse } from 'next/server';
import { getPostCategories, getReviewCategories } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [categories, reviewCategories] = await Promise.all([
    getPostCategories(),
    getReviewCategories(),
  ]);
  return NextResponse.json({ categories, reviewCategories });
}
