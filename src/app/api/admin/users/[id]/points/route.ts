// POST /api/admin/users/[id]/points  调整用户积分 (增加/扣除/设置)
// GET  /api/admin/users/[id]/points  查看积分流水
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const AdjustSchema = z.object({
  amount: z.number().int(),      // 正数增加, 负数扣除
  reason: z.string().max(200).optional().or(z.literal('')),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'points.adjust');
    const logs = await prisma.pointsLog.findMany({
      where: { userId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { admin: { select: { nickname: true } } },
    });
    return NextResponse.json({ items: logs });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, 'points.adjust');
    const { amount, reason } = AdjustSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, points: true } });
    if (!user) throw new Error('用户不存在');

    const newBalance = user.points + amount;
    if (newBalance < 0) throw new Error('扣除后积分不能为负');

    const result = await prisma.$transaction([
      prisma.user.update({
        where: { id: params.id },
        data: { points: { increment: amount } },
      }),
      prisma.pointsLog.create({
        data: {
          userId: params.id,
          adminId: admin.id,
          amount,
          balanceAfter: newBalance,
          reason: reason || null,
        },
      }),
    ]);

    return NextResponse.json({ success: true, points: result[0].points, log: result[1] });
  } catch (e) { return errorResponse(e); }
}
