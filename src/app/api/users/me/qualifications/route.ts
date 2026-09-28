// GET  /api/users/me/qualifications  查询我的资质/荣誉认证列表
// POST /api/users/me/qualifications  提交新的资质/荣誉认证申请
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { VerificationStatus, UserRole, NotificationType } from '@prisma/client';
import { createNotification } from '@/lib/notification-service';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const SubmitSchema = z.object({
  type: z.string().min(1).max(50, '名称最多 50 字'),
  category: z.enum(['QUALIFICATION', 'HONOR']).default('QUALIFICATION'),
  photo: z.string().min(1).max(Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 100).optional(),
  photo2: z.string().min(1).max(Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return NextResponse.json({ message: '未登录' }, { status: 401 });
    const items = await prisma.qualification.findMany({
      where: { userId: me.id },
      orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return NextResponse.json({ message: '未登录' }, { status: 401 });

    const dto = SubmitSchema.parse(await req.json());

    let photoData: string | null = null;
    if (dto.photo) {
      const base64Data = dto.photo.split(',')[1] || dto.photo;
      const byteLen = Math.floor((base64Data.length * 3) / 4);
      if (byteLen > MAX_PHOTO_BYTES) {
        return NextResponse.json({ message: '证明材料过大, 请小于 5MB' }, { status: 400 });
      }
      photoData = dto.photo;
    }

    let photo2Data: string | null = null;
    if (dto.photo2) {
      const base64Data = dto.photo2.split(',')[1] || dto.photo2;
      const byteLen = Math.floor((base64Data.length * 3) / 4);
      if (byteLen > MAX_PHOTO_BYTES) {
        return NextResponse.json({ message: '第二张证明材料过大, 请小于 5MB' }, { status: 400 });
      }
      photo2Data = dto.photo2;
    }

    const q = await prisma.qualification.create({
      data: {
        userId: me.id,
        type: dto.type.trim(),
        category: dto.category,
        photo: photoData,
        photo2: photo2Data,
        status: VerificationStatus.PENDING,
      },
    });

    // 通知管理员审核
    const submitTime = new Date().toLocaleString('zh-CN');
    const catLabel = dto.category === 'HONOR' ? '荣誉' : '资质';
    const notifContent = `用户「${me.nickname || me.email}」于 ${submitTime} 提交了${catLabel}认证 (${dto.type})。\n请前往审核。`;
    for (const r of [UserRole.SUPER_ADMIN, UserRole.ADMIN]) {
      await createNotification({
        targetRole: r,
        type: NotificationType.SYSTEM,
        title: `新的${catLabel}认证待审核`,
        content: notifContent,
        link: '/profile?tab=qualifications',
      });
    }

    return NextResponse.json({
      message: `${catLabel}认证申请已提交, 等待管理员审核`,
      qualification: q,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
