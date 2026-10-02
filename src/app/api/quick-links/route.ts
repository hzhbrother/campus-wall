// GET /api/quick-links  获取启用的快捷通道列表 (公开)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const links = await prisma.quickLink.findMany({
    where: { isActive: true },
    orderBy: [
      { clickCount: 'desc' },   // 点击次数多的排前面
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });
  return NextResponse.json({ items: links });
}
