// GET /api/auth/me  当前登录用户
import { NextRequest } from 'next/server';
import { getUserFromRequest, sanitize } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return Response.json(null, { status: 200 });
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      include: {
        _count: { select: { posts: true, comments: true, likes: true } },
        customRole: { select: { id: true, name: true, permissions: true } },
      },
    });
    if (!user) return Response.json(null, { status: 200 });
    // 获赞数: 用户所有帖子收到的点赞总数
    const likesReceived = await prisma.like.count({
      where: { post: { authorId: me.id } },
    });
    const data = sanitize(user) as any;
    // 管理员/超级管理员默认已认证
    if (data.role === 'ADMIN' || data.role === 'SUPER_ADMIN') {
      data.verified = true;
    }
    data._count = { ...data._count, likesReceived };
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
