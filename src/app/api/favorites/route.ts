// GET /api/favorites  当前用户的收藏列表
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 20)));

    const [items, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          // 不取 base64 图片内容, 收藏列表页用不到, 减少传输体积
          post: {
            select: {
              id: true, authorId: true, title: true, content: true, category: true,
              isAnonymous: true, status: true, pinned: true,
              viewCount: true, likeCount: true, commentCount: true,
              createdAt: true, updatedAt: true,
              author: { select: { id: true, nickname: true, avatar: true } },
            },
          },
        },
      }),
      prisma.favorite.count({ where: { userId: me.id } }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    return errorResponse(e);
  }
}
