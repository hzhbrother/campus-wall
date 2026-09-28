// POST /api/users/me/badges/:id/claim  领取勋章 (设置 claimedAt)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    // 查询该用户的勋章记录 (id + userId 双重校验, 避免越权领取他人勋章)
    const userBadge = await prisma.userBadge.findFirst({
      where: { id: params.id, userId: me.id },
    });
    if (!userBadge) {
      return NextResponse.json({ message: '勋章记录不存在' }, { status: 404 });
    }
    // 已领取: 幂等返回, 避免重复领取
    if (userBadge.claimedAt) {
      return NextResponse.json({ message: '已领取', claimedAt: userBadge.claimedAt });
    }
    // 标记领取时间
    const updated = await prisma.userBadge.update({
      where: { id: userBadge.id },
      data: { claimedAt: new Date() },
    });
    return NextResponse.json({ id: updated.id, claimedAt: updated.claimedAt, message: '领取成功' });
  } catch (e) {
    return errorResponse(e);
  }
}
