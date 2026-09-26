// POST /api/users/me/qualification  提交资质/荣誉认证申请 (可重复提交)
// GET  /api/users/me/qualification  查询资质认证状态
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { VerificationStatus, UserRole, NotificationType } from '@prisma/client';
import { createNotification } from '@/lib/notification-service';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const SubmitSchema = z.object({
  photo: z.string().min(1).max(Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 100),
  type: z.string().min(1).max(50), // 用户填写的资质/荣誉类型
});

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return NextResponse.json({ message: '未登录' }, { status: 401 });
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        qualificationType: true,
        qualificationVerified: true,
        qualificationVerifiedAt: true,
        qualificationStatus: true,
        qualificationRejectReason: true,
      },
    });
    return NextResponse.json(user);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return NextResponse.json({ message: '未登录' }, { status: 401 });

    const dto = SubmitSchema.parse(await req.json());
    const base64Data = dto.photo.split(',')[1] || dto.photo;
    const byteLen = Math.floor((base64Data.length * 3) / 4);
    if (byteLen > MAX_PHOTO_BYTES) {
      return NextResponse.json({ message: '照片过大, 请小于 5MB' }, { status: 400 });
    }

    // 资质/荣誉认证可无限重新认证: 无论当前状态都允许重新提交
    await prisma.user.update({
      where: { id: me.id },
      data: {
        qualificationPhoto: dto.photo,
        qualificationType: dto.type,
        qualificationStatus: VerificationStatus.PENDING,
        qualificationRejectReason: null,
      },
    });

    // 通知管理员审核
    const submitTime = new Date().toLocaleString('zh-CN');
    const notifContent = `用户「${me.nickname || me.email}」于 ${submitTime} 提交了资质/荣誉认证 (${dto.type})。\n请前往审核。`;
    for (const r of [UserRole.SUPER_ADMIN, UserRole.ADMIN]) {
      await createNotification({
        targetRole: r,
        type: NotificationType.SYSTEM,
        title: '新的资质认证待审核',
        content: notifContent,
        link: '/profile?tab=users',
      });
    }

    return NextResponse.json({
      message: '资质认证申请已提交, 等待管理员审核',
      qualificationStatus: VerificationStatus.PENDING,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
