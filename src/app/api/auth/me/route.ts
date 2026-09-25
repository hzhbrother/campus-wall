// GET /api/auth/me  当前登录用户
import { NextRequest } from 'next/server';
import { getUserFromRequest, sanitize } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return Response.json(null, { status: 200 });
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    return Response.json(user ? sanitize(user) : null);
  } catch (e) {
    return errorResponse(e);
  }
}
