// GET /api/posts/categories  分类目录 (从站点配置读取)
import { NextResponse } from 'next/server';
import { getPostCategories } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cats = await getPostCategories();
  return NextResponse.json(cats);
}
