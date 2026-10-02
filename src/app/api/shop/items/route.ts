// GET /api/shop/items  获取上架商品列表 (公开)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await prisma.shopItem.findMany({
    where: { isActive: true },
    orderBy: [{ pointsCost: 'asc' }],
  });
  return NextResponse.json({ items });
}
