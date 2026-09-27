// GET /api/users/[id]/badges  查看某用户已获得的勋章
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const items = await prisma.userBadge.findMany({
      where: { userId: params.id },
      include: { badge: { select: { id: true, name: true, description: true, icon: true, imageUrl: true } } },
      orderBy: { earnedAt: 'desc' },
    });
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
