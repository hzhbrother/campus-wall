// GET   /api/qualifications/:id  奖状/资质详情 (匿名可访问, 受可见性限制)
// PATCH /api/qualifications/:id  修改可见性 (仅 owner 本人)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest, requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { isQualificationVisible } from './visibility';

// 用户简要信息 (返回给前端: id, nickname, avatar, verified; role 用于内部 isAdmin 判断)
const USER_SELECT = {
  id: true,
  nickname: true,
  avatar: true,
  role: true,
  verified: true,
} as const;

// GET 奖状/资质详情
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const q = await prisma.qualification.findUnique({
      where: { id: params.id },
      include: {
        user: { select: USER_SELECT },
        _count: { select: { comments: true, likes: true } },
      },
    });
    if (!q) return NextResponse.json({ message: '资质/奖状不存在' }, { status: 404 });

    const viewer = await getUserFromRequest(req);
    const decision = await isQualificationVisible(q, viewer?.id ?? null);
    if (!decision.visible) {
      return NextResponse.json({ message: decision.message }, { status: decision.status });
    }

    // 管理员/超级管理员默认已认证
    const isAdmin = q.user.role === 'ADMIN' || q.user.role === 'SUPER_ADMIN';
    const user = { ...q.user, verified: q.user.verified || isAdmin };

    // 查看当前用户是否已点赞
    let liked = false;
    if (viewer) {
      const hit = await prisma.qualificationLike.findUnique({
        where: { qualificationId_userId: { qualificationId: params.id, userId: viewer.id } },
      });
      liked = !!hit;
    }

    return NextResponse.json({ ...q, user, liked });
  } catch (e) {
    return errorResponse(e);
  }
}

const VisibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']),
});

// PATCH 修改可见性 (仅 owner 本人; 其他字段由管理员在 admin API 改)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    const dto = VisibilitySchema.parse(await req.json());

    const q = await prisma.qualification.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!q) return NextResponse.json({ message: '资质/奖状不存在' }, { status: 404 });
    if (q.userId !== me.id) {
      return NextResponse.json({ message: '只能修改自己的资质可见性' }, { status: 403 });
    }

    const updated = await prisma.qualification.update({
      where: { id: params.id },
      data: { visibility: dto.visibility },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
