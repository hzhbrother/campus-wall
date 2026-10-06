// GET /api/posts/meta  首页一次性返回 分类 + 审核分类 + 公告, 减少 HTTP 往返
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { getPostCategories, getReviewCategories, getSiteConfigValue } from '@/lib/site-config';

export async function GET() {
  try {
    const [categories, reviewCategories, announcement] = await Promise.all([
      getPostCategories(),
      getReviewCategories(),
      getSiteConfigValue('announcement_text', ''),
    ]);
    return NextResponse.json({ categories, reviewCategories, announcement });
  } catch (e) {
    return errorResponse(e);
  }
}
