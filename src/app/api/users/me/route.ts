// GET   /api/users/me   当前用户完整资料
// PATCH /api/users/me   更新自己的资料
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, sanitize } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  nickname: z.string().max(32).optional(),
  avatar: z.string().optional(),
  studentId: z.string().max(20).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      include: { _count: { select: { posts: true, comments: true, likes: true } } },
    });
    return NextResponse.json(sanitize(user));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = UpdateSchema.parse(await req.json());
    const user = await prisma.user.update({ where: { id: me.id }, data: dto });
    return NextResponse.json(sanitize(user));
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
