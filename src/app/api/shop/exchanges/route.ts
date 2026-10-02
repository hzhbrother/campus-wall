// GET /api/shop/exchanges  获取当前用户的兑换记录
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await requireUser(req);
  const records = await prisma.exchangeRecord.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    include: { item: true },
  });
  return NextResponse.json({ items: records });
}
