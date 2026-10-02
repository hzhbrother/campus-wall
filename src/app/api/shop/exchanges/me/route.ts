// GET /api/shop/exchanges/me  获取当前用户的兑换记录
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const records = await prisma.exchangeRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { item: { select: { name: true, image: true } } },
    });
    return NextResponse.json({ items: records });
  } catch (e) { return errorResponse(e); }
}
