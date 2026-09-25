// POST /api/posts/:id/like  点赞/取消 (toggle)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    // 临时封禁用户仍可点赞, 永久封禁无法登录
    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId: params.id, userId: me.id } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id: params.id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return NextResponse.json({ liked: false, likeCount: Math.max(0, post.likeCount - 1) });
    }
    await prisma.$transaction([
      prisma.like.create({ data: { postId: params.id, userId: me.id } }),
      prisma.post.update({ where: { id: params.id }, data: { likeCount: { increment: 1 } } }),
    ]);
    return NextResponse.json({ liked: true, likeCount: post.likeCount + 1 });
  } catch (e) {
    return errorResponse(e);
  }
}
