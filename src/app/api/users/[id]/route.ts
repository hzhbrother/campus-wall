// GET /api/users/:id  用户公开主页
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { getUserFromRequest } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 判断访问者是否为本用户本人 (本人可见 followsPublic 隐私开关)
    const me = await getUserFromRequest(req);
    const isSelf = me?.id === params.id;
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, nickname: true, avatar: true, coverImage: true,
        role: true, verified: true, verificationStatus: true,
        qualificationType: true, qualificationVerified: true,
        points: true, userNumber: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        // 关注/粉丝统计数 (通过 _count 返回)
        _count: { select: { posts: true, comments: true, favorites: true, follows: true, followers: true } },
        // 隐私开关字段: 仅本人返回 (下方从对外响应中剥离)
        followsPublic: true,
        fansPublic: true,
        badgesPublic: true,
        honorsPublic: true,
        favoritesPublic: true,
        likesPublic: true,
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
    // 荣誉认证返回证明材料图片 (displayPhoto 决定展示哪一面), 资质认证仅返回文字
    const qualifications = await prisma.qualification.findMany({
      where: { userId: params.id, verified: true },
      orderBy: { verifiedAt: 'desc' },
      select: {
        id: true, type: true, category: true, verifiedAt: true,
        photo: true, photo2: true, displayPhoto: true,
      },
    });
    // 公开响应: 剥离 6 个隐私开关字段, 仅本人可见时回填
    const {
      followsPublic, fansPublic, badgesPublic, honorsPublic, favoritesPublic, likesPublic,
      ...publicUser
    } = user;
    const body: Record<string, any> = {
      ...publicUser,
      verified,
      qualifications,
      _count: { ...publicUser._count, likesReceived },
    };
    if (isSelf) {
      body.followsPublic = followsPublic;
      body.fansPublic = fansPublic;
      body.badgesPublic = badgesPublic;
      body.honorsPublic = honorsPublic;
      body.favoritesPublic = favoritesPublic;
      body.likesPublic = likesPublic;
    }
    return NextResponse.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
