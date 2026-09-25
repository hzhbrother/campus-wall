// GET /api/users/:id  用户公开主页
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, nickname: true, avatar: true, coverImage: true,
        role: true, grade: true, className: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true } },
      },
    });
    if (!user) return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    // 获赞数: 用户所有帖子收到的点赞总数
    const likesReceived = await prisma.like.count({
      where: { post: { authorId: params.id } },
    });
    return NextResponse.json({ ...user, _count: { ...user._count, likesReceived } });
  } catch (e) {
    return errorResponse(e);
  }
}
