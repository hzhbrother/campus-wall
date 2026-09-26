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
        role: true, grade: true, className: true, verified: true, verificationStatus: true,
        qualificationType: true, qualificationVerified: true,
        points: true, userNumber: true,
        createdAt: true,
        school: { select: { id: true, name: true, gradeCount: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { posts: true, comments: true, favorites: true } },
      },
    });
    if (!user) return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    // 管理员/超级管理员默认已认证
    const verified = user.verified || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    // 获赞数: 用户所有帖子收到的点赞总数
    const likesReceived = await prisma.like.count({
      where: { post: { authorId: params.id } },
    });
    // 已通过的资质/荣誉认证 (用于主页展示)
    const qualifications = await prisma.qualification.findMany({
      where: { userId: params.id, verified: true },
      orderBy: { verifiedAt: 'desc' },
      select: { id: true, type: true, category: true, verifiedAt: true },
    });
    return NextResponse.json({ ...user, verified, qualifications, _count: { ...user._count, likesReceived } });
  } catch (e) {
    return errorResponse(e);
  }
}
