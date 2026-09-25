// GET /api/posts/my  我的帖子 (含未通过)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: me.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where: { authorId: me.id } }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    return errorResponse(e);
  }
}
