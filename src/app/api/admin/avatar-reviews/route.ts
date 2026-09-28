// GET /api/admin/avatar-reviews  待审核头像列表 (ADMIN+)
// 返回所有 avatarStatus=PENDING 且 pendingAvatar 非空的用户
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'user.view');
    const users = await prisma.user.findMany({
      where: {
        avatarStatus: 'PENDING',
        pendingAvatar: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        avatar: true,            // 旧头像
        pendingAvatar: true,     // 新头像 (待审核)
        avatarStatus: true,
        createdAt: true,         // 提交时间
      },
    });
    return NextResponse.json({ items: users });
  } catch (e) {
    return errorResponse(e);
  }
}
