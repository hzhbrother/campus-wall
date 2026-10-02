// PATCH /api/admin/shop/exchanges/[id]  更新兑换状态 (FULFILLED/CANCELLED)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'shop.manage');
    const { status } = UpdateSchema.parse(await req.json());

    const record = await prisma.exchangeRecord.findUnique({ where: { id: params.id } });
    if (!record) throw new Error('兑换记录不存在');

    // 如果取消, 退还积分
    if (status === 'CANCELLED' && record.status !== 'CANCELLED') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { points: { increment: record.pointsCost } } }),
        prisma.exchangeRecord.update({ where: { id: params.id }, data: { status } }),
      ]);
    } else {
      await prisma.exchangeRecord.update({ where: { id: params.id }, data: { status } });
    }

    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
