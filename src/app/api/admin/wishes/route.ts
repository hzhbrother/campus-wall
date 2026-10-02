// GET /api/admin/wishes  许愿列表
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'wish.review');
    const wishes = await prisma.wishItem.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { user: { select: { nickname: true, email: true } } },
    });
    return NextResponse.json({ items: wishes });
  } catch (e) { return errorResponse(e); }
}
