// POST   /api/qualifications/[id]/like  点赞/取消点赞 (切换)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { isQualificationVisible } from '../visibility';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(_req);

    const q = await prisma.qualification.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true } } },
    });
    if (!q) return NextResponse.json({ message: '奖状不存在' }, { status: 404 });

    // 可见性校验 (看不到就不能点赞)
    const decision = await isQualificationVisible(q, me.id);
    if (!decision.visible) {
      return NextResponse.json({ message: decision.message }, { status: decision.status });
    }

    const existing = await prisma.qualificationLike.findUnique({
      where: { qualificationId_userId: { qualificationId: params.id, userId: me.id } },
    });

    if (existing) {
      await prisma.qualificationLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    } else {
      await prisma.qualificationLike.create({
        data: { qualificationId: params.id, userId: me.id },
      });
      return NextResponse.json({ liked: true });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
