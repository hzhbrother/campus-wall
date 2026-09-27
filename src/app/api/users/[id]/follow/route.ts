// GET /api/users/:id/follow  指定用户的关注/粉丝列表
//   query: type=following|followers, page, pageSize
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

// 用户简要信息 (列表返回)
const USER_SELECT = {
  id: true,
  nickname: true,
  avatar: true,
  realName: true,
  verified: true,
} as const;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const targetId = params.id;
    // 访问者 (可能未登录, 公开列表可匿名访问)
    const visitor = await getUserFromRequest(req);

    const url = new URL(req.url);
    const type = url.searchParams.get('type') === 'followers' ? 'followers' : 'following';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 20)));

    // 目标用户必须存在, 且需要其 followsPublic 字段做隐私判断
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, followsPublic: true },
    });
    if (!targetUser) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }
    // 隐私控制: 访问者不是用户本人且对方隐藏关注列表 -> 403
    const isSelf = visitor?.id === targetId;
    if (!isSelf && !targetUser.followsPublic) {
      return NextResponse.json({ message: '对方已隐藏关注列表' }, { status: 403 });
    }

    // following: targetId 关注的人 (followerId = targetId)
    // followers : 关注 targetId 的人 (followingId = targetId)
    const where = type === 'following'
      ? { followerId: targetId }
      : { followingId: targetId };

    const [rows, total] = await Promise.all([
      prisma.follow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          following: { select: USER_SELECT },
          follower: { select: USER_SELECT },
        },
      }),
      prisma.follow.count({ where }),
    ]);
    // following 列取 following 关系用户; followers 列取 follower 关系用户
    const items = rows.map(r => (type === 'following' ? r.following : r.follower));
    return NextResponse.json({ items, total, type, page, pageSize });
  } catch (e) {
    return errorResponse(e);
  }
}
