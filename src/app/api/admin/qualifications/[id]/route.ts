// PATCH  /api/admin/qualifications/:id  审核资质/荣誉认证 (通过/驳回)
// DELETE /api/admin/qualifications/:id  删除资质/荣誉认证记录
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { VerificationStatus, NotificationType } from '@prisma/client';
import { createNotification } from '@/lib/notification-service';

const ReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'NONE']),
  rejectReason: z.string().max(200).optional().or(z.literal('')),
  displayPhoto: z.enum(['photo', 'photo2']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'qualification.review');
    const dto = ReviewSchema.parse(await req.json());

    const q = await prisma.qualification.findUnique({ where: { id: params.id } });
    if (!q) return NextResponse.json({ message: '资质认证记录不存在' }, { status: 404 });

    const data: any = {};
    if (dto.status === 'APPROVED') {
      data.status = VerificationStatus.APPROVED;
      data.verified = true;
      data.verifiedAt = new Date();
      data.rejectReason = null;
      // 通过时若未指定展示面, 默认用第一张; 若只有第二张则用第二张
      if (dto.displayPhoto) {
        data.displayPhoto = dto.displayPhoto;
      } else if (!q.displayPhoto) {
        data.displayPhoto = q.photo ? 'photo' : (q.photo2 ? 'photo2' : null);
      }
    } else if (dto.status === 'REJECTED') {
      data.status = VerificationStatus.REJECTED;
      data.verified = false;
      data.verifiedAt = null;
      data.rejectReason = dto.rejectReason || null;
    } else {
      data.status = VerificationStatus.NONE;
      data.verified = false;
      data.verifiedAt = null;
      data.rejectReason = null;
    }
    // 允许管理员单独切换展示面 (即使已审核通过)
    if (dto.displayPhoto) {
      data.displayPhoto = dto.displayPhoto;
    }

    const updated = await prisma.qualification.update({ where: { id: params.id }, data });

    // 通知用户审核结果
    const catLabel = q.category === 'HONOR' ? '荣誉' : '资质';
    if (dto.status === 'APPROVED') {
      await createNotification({
        userId: q.userId,
        type: NotificationType.SYSTEM,
        title: `✅ ${catLabel}认证已通过`,
        content: `恭喜您, 您的「${q.type}」${catLabel}认证已通过审核!`,
      });
    } else if (dto.status === 'REJECTED') {
      await createNotification({
        userId: q.userId,
        type: NotificationType.SYSTEM,
        title: `❌ ${catLabel}认证被驳回`,
        content: `您的「${q.type}」${catLabel}认证未通过, 原因: ${dto.rejectReason || '请重新提交'}`,
      });
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'qualification.review');
    await prisma.qualification.delete({ where: { id: params.id } });
    return NextResponse.json({ message: '已删除' });
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ message: '记录不存在' }, { status: 404 });
    return errorResponse(e);
  }
}
