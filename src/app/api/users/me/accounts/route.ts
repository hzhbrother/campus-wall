// GET /api/users/me/accounts  获取当前用户已绑定的第三方账号
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await requireUser(req);
  const accounts = await prisma.account.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ accounts });
}
