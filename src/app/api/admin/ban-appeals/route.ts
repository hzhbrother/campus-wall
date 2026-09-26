// GET /api/admin/ban-appeals  管理员查看封禁申诉列表
// PATCH /api/admin/ban-appeals/[id]  审核申诉 (approve/reject)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { unbanUser } from '@/lib/admin-service';

// GET: 申诉列表
export async function GET(req: NextRequest) {
  try {
    const me = await requirePermission(req, 'appeal.view');
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // PENDING | APPROVED | REJECTED | ALL

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const appeals = await prisma.banAppeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, nickname: true, avatar: true, email: true } },
        banRecord: { select: { id: true, reason: true, durationDays: true, bannedUntil: true, isPermanent: true, createdAt: true } },
      },
    });

    return NextResponse.json({ items: appeals });
  } catch (e) {
    return errorResponse(e);
  }
}

// PATCH: 审核申诉
export async function PATCH(req: NextRequest) {
  try {
    const me = await requirePermission(req, 'appeal.handle');
    const { id, action, reviewerNote } = await req.json().catch(() => ({}));
    if (!id || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ message: '参数错误' }, { status: 400 });
    }

    const appeal = await prisma.banAppeal.findUnique({ where: { id } });
    if (!appeal) return NextResponse.json({ message: '申诉不存在' }, { status: 404 });
    if (appeal.status !== 'PENDING') return NextResponse.json({ message: '该申诉已处理' }, { status: 400 });

    const updated = await prisma.banAppeal.update({
      where: { id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewerNote: reviewerNote || null,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { id: true, nickname: true } },
        banRecord: { select: { userId: true } },
      },
    });

    // 申诉通过 → 自动解封该用户
    if (action === 'APPROVE') {
      await unbanUser(updated.banRecord.userId, me.id);
    }

    // 通知申诉用户审核结果
    const { createNotification } = await import('@/lib/notification-service');
    const { NotificationType } = await import('@prisma/client');
    const resultText = action === 'APPROVE' ? '申诉通过, 账号已解封' : '申诉被驳回';
    await createNotification({
      userId: updated.userId,
      type: NotificationType.SYSTEM,
      title: '封禁申诉审核结果',
      content: `您的封禁申诉${action === 'APPROVE' ? '已通过, 账号已解封' : '被驳回'}。${reviewerNote ? '\n审核备注: ' + reviewerNote : ''}`,
      link: '/profile/ban-appeal',
    });

    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}
