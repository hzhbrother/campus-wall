// POST /api/shop/exchange  兑换商品
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { itemId } = await req.json();

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) throw new Error('商品不存在或已下架');
    if (item.stock === 0) throw new Error('商品已兑完');

    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user) throw new Error('用户不存在');
    if (user.points < item.pointsCost) throw new Error(`积分不足, 需要 ${item.pointsCost} 积分`);

    const record = await prisma.$transaction(async (tx) => {
      // 扣积分
      await tx.user.update({
        where: { id: me.id },
        data: { points: { decrement: item.pointsCost } },
      });
      // 减库存
      if (item.stock > 0) {
        await tx.shopItem.update({
          where: { id: itemId },
          data: { stock: { decrement: 1 } },
        });
      }
      // 创建兑换记录
      return tx.exchangeRecord.create({
        data: {
          userId: me.id,
          itemId,
          pointsCost: item.pointsCost,
        },
      });
    });

    return NextResponse.json({ success: true, record });
  } catch (e: any) {
    return errorResponse(e);
  }
}
