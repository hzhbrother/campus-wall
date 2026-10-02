// GET /api/admin/shop/exchanges  兑换记录列表
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'shop.manage');
    const records = await prisma.exchangeRecord.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { nickname: true } }, item: { select: { name: true } } },
    });
    return NextResponse.json({ items: records });
  } catch (e) { return errorResponse(e); }
}
