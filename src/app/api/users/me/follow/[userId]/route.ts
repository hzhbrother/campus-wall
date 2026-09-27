// DELETE /api/users/me/follow/:userId  取消关注
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const me = await requireUser(req);
    // 按复合唯一键定位, 不存在即幂等返回未关注
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: params.userId } },
    });
    if (!existing) {
      return NextResponse.json({ followed: false, message: '未关注该用户' });
    }
    await prisma.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ followed: false });
  } catch (e) {
    return errorResponse(e);
  }
}
