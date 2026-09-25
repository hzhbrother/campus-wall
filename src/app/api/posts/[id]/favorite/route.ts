// POST /api/posts/:id/favorite  收藏/取消收藏 (toggle)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    // 临时封禁用户仍可收藏, 永久封禁无法登录
    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });

    const existing = await prisma.favorite.findUnique({
      where: { userId_postId: { userId: me.id, postId: params.id } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    }
    await prisma.favorite.create({ data: { userId: me.id, postId: params.id } });
    return NextResponse.json({ favorited: true });
  } catch (e) {
    return errorResponse(e);
  }
}
