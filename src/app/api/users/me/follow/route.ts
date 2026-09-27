// GET  /api/users/me/follow  我关注的人列表 (带分页)
// POST /api/users/me/follow  关注某人
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { NotificationType } from '@prisma/client';
import { createNotification } from '@/lib/notification-service';

// 用户简要信息 (关注列表返回)
const USER_SELECT = {
  id: true,
  nickname: true,
  avatar: true,
  realName: true,
  verified: true,
} as const;

// 获取我关注的人列表 (带分页, page/pageSize 默认 1/20)
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 20)));

    const [rows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: me.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { following: { select: USER_SELECT } },
      }),
      prisma.follow.count({ where: { followerId: me.id } }),
    ]);
    return NextResponse.json({
      items: rows.map(f => f.following),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// 关注某人, body: { userId }
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await req.json();
    const targetId = body?.userId;
    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ message: '缺少 userId' }, { status: 400 });
    }
    // 不能关注自己
    if (targetId === me.id) {
      return NextResponse.json({ message: '不能关注自己' }, { status: 400 });
    }
    // 被关注者必须存在
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }
    try {
      // 唯一约束兜底: 已关注时 create 会抛 P2002
      await prisma.follow.create({ data: { followerId: me.id, followingId: targetId } });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return NextResponse.json({ message: '已经关注过该用户', followed: true }, { status: 409 });
      }
      throw e;
    }
    // 给被关注者发系统通知 (提示关注者昵称)
    await createNotification({
      userId: targetId,
      type: NotificationType.SYSTEM,
      title: '🔔 新粉丝',
      content: `「${me.nickname || '匿名用户'}」关注了你`,
      link: `/users/${me.id}`,
    });
    return NextResponse.json({ followed: true });
  } catch (e) {
    return errorResponse(e);
  }
}
