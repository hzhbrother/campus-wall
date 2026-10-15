// DELETE /api/users/me  注销账号 (软删除: 标记 DELETED + 匿名化)
import { NextRequest, NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);

    // 超级管理员不允许注销
    if (me.role === 'SUPER_ADMIN') {
      return NextResponse.json({ message: '超级管理员账号不可注销' }, { status: 400 });
    }

    // 匿名化用户信息, 保留帖子/评论等内容 (作者显示为「已注销用户」)
    await prisma.user.update({
      where: { id: me.id },
      data: {
        status: UserStatus.DELETED,
        nickname: '已注销用户',
        email: null,
        phoneNumber: null,
        avatar: null,
        password: null,
        realName: null,
        studentId: null,
        // 清除第三方绑定
        accounts: { deleteMany: {} },
        // 清除签到记录
        checkIns: { deleteMany: {} },
        // 清除收藏
        favorites: { deleteMany: {} },
        // 清除关注/粉丝
        followers: { deleteMany: {} },
        follows: { deleteMany: {} },
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return errorResponse(e);
  }
}
