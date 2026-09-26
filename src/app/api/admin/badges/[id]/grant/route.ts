// GET    /api/admin/badges/[id]/grant  查询拥有该徽章的用户列表 (SUPER_ADMIN)
// POST   /api/admin/badges/[id]/grant  手动授予徽章给指定用户 (SUPER_ADMIN)
// DELETE /api/admin/badges/[id]/grant?userId=xxx  撤销用户的徽章 (SUPER_ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/server-auth';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';

const GrantSchema = z.object({
  userId: z.string().min(1, '用户 ID 不能为空'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const holders = await prisma.userBadge.findMany({
      where: { badgeId: params.id },
      orderBy: { earnedAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true, avatar: true, realName: true } },
      },
    });
    return NextResponse.json({ items: holders });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = GrantSchema.parse(await req.json());

    const badge = await prisma.badge.findUnique({ where: { id: params.id } });
    if (!badge) return NextResponse.json({ message: '徽章不存在' }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, nickname: true } });
    if (!user) return NextResponse.json({ message: '用户不存在' }, { status: 404 });

    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId: dto.userId, badgeId: params.id } },
    });
    if (existing) return NextResponse.json({ message: '该用户已拥有此徽章' }, { status: 400 });

    await prisma.userBadge.create({ data: { userId: dto.userId, badgeId: params.id } });

    await createNotification({
      userId: dto.userId,
      title: '🎉 获得新勋章',
      content: `恭喜您获得「${badge.name}」勋章！`,
      type: 'SYSTEM' as any,
    });

    return NextResponse.json({ message: `已授予用户「${user.nickname}」徽章「${badge.name}」` });
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return NextResponse.json({ message: '缺少 userId 参数' }, { status: 400 });

    await prisma.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId: params.id } },
    });
    return NextResponse.json({ message: '已撤销' });
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ message: '该用户未拥有此徽章' }, { status: 404 });
    return errorResponse(e);
  }
}
