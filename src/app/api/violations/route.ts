// GET /api/violations  当前用户的违规记录 + 诚信分 + 折线图数据
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { getCurrentScore, getScoreChartData } from '@/lib/credibility-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const [records, score, chart] = await Promise.all([
      prisma.violationRecord.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      getCurrentScore(me.id),
      getScoreChartData(me.id, 30),
    ]);
    return NextResponse.json({ items: records, score, chart });
  } catch (e) {
    return errorResponse(e);
  }
}
