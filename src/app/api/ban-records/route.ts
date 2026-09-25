// GET /api/ban-records  当前用户的封禁记录列表
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const records = await prisma.banRecord.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      include: {
        appeals: { orderBy: { createdAt: 'desc' } },
      },
    });
    return NextResponse.json({ items: records });
  } catch (e) {
    return errorResponse(e);
  }
}
