// DELETE /api/users/me/accounts/[provider]  解绑第三方账号
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { AccountProvider } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const me = await requireUser(req);
    const provider = params.provider as AccountProvider;

    if (provider === 'LOCAL') throw new Error('不能解绑本地账号');

    const account = await prisma.account.findFirst({
      where: { userId: me.id, provider },
    });
    if (!account) throw new Error('未找到该绑定');

    // 检查是否是唯一登录方式 (没有密码且只有这一个账号)
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    const accountCount = await prisma.account.count({ where: { userId: me.id } });
    if (!user?.password && accountCount <= 1) {
      throw new Error('这是您唯一的登录方式, 解绑后将无法登录, 请先设置密码');
    }

    await prisma.account.delete({ where: { id: account.id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return errorResponse(e);
  }
}
