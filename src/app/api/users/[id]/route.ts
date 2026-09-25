// GET /api/users/:id  用户公开主页
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, nickname: true, avatar: true, role: true, createdAt: true, _count: { select: { posts: true } } },
    });
    if (!user) return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    return errorResponse(e);
  }
}
