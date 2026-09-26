// POST /api/users/me/verification  提交实名认证申请 (上传校园卡照片)
// GET  /api/users/me/verification  查询当前认证状态
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { VerificationStatus, UserRole, NotificationType } from '@prisma/client';
import { isVisionEnabled, preliminaryReview, preliminaryFaceReview } from '@/lib/ai-vision';
import { createNotification } from '@/lib/notification-service';

// 照片上限 5MB (base64 后约 6.7MB)
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const SubmitSchema = z.object({
  photo: z.string().min(1).max(Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 100),
  templateId: z.string().optional(),
  photoType: z.enum(['CARD', 'FACE']).optional(), // 卡面 / 人脸
});

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return NextResponse.json({ message: '未登录' }, { status: 401 });
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        verified: true,
        verifiedAt: true,
        verificationStatus: true,
        verificationRejectReason: true,
        verificationPhoto: true,
        verificationAiResult: true,
      },
    });
    if (!user) return NextResponse.json({ message: '用户不存在' }, { status: 404 });
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

    // 校验 base64 图片
    const base64Data = dto.photo.split(',')[1] || dto.photo;
    const byteLen = Math.floor((base64Data.length * 3) / 4);
    if (byteLen > MAX_PHOTO_BYTES) {
      return NextResponse.json({ message: '照片过大, 请小于 5MB' }, { status: 400 });
    }
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(dto.photo) && !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      return NextResponse.json({ message: '照片格式不正确, 请上传 JPG/PNG 图片' }, { status: 400 });
    }

    // 初始状态: 若配置了 AI 视觉则进入 AI 初审, 否则直接进入人工复审队列
    const initStatus = isVisionEnabled() ? VerificationStatus.AI_REVIEWING : VerificationStatus.PENDING;

    await prisma.user.update({
      where: { id: me.id },
      data: {
        verificationPhoto: dto.photo,
        verificationPhotoType: dto.photoType || 'CARD',
        verificationTemplateId: dto.photoType === 'FACE' ? null : (dto.templateId || null),
        verificationStatus: initStatus,
        verificationRejectReason: null,
        verificationAiResult: null,
      },
    });

    // 异步触发 AI 初审 (不阻塞响应)
    if (isVisionEnabled()) {
      const isFace = dto.photoType === 'FACE';
      runAiReview(me.id, dto.photo, dto.photoType === 'FACE' ? null : (dto.templateId || null), isFace).catch(e => console.error('[verification] AI review failed:', e));
    }

    // 通知所有管理员: 有新的实名认证申请待审核
    const submitTime = new Date().toLocaleString('zh-CN');
    const photoTypeText = dto.photoType === 'FACE' ? '人脸照片' : '证件照片';
    const notifContent = `用户「${me.nickname || me.email}」于 ${submitTime} 提交了认证申请 (${photoTypeText})。\n点击查看详情并审核。`;
    await createNotification({
      targetRole: UserRole.SUPER_ADMIN,
      type: NotificationType.SYSTEM,
      title: '新的实名认证待审核',
      content: notifContent,
      link: '/profile?tab=verification',
    });
    await createNotification({
      targetRole: UserRole.ADMIN,
      type: NotificationType.SYSTEM,
      title: '新的实名认证待审核',
      content: notifContent,
      link: '/profile?tab=verification',
    });

    return NextResponse.json({
      message: initStatus === VerificationStatus.AI_REVIEWING
        ? '认证申请已提交, AI 正在初审'
        : '认证申请已提交, 等待人工复审',
      verificationStatus: initStatus,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}

// AI 初审: 判断是否校园卡 + 清晰度, 通过则进入人工复审, 不通过则直接驳回
async function runAiReview(userId: string, photo: string, templateId: string | null, isFace: boolean) {
  let result;
  if (isFace) {
    // 人脸照片: 检测人脸 + 清晰度
    result = await preliminaryFaceReview(photo);
  } else {
    // 卡面照片: 加载模板 + OCR 文字提取
    let template: any = null;
    if (templateId) {
      template = await prisma.verificationTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, name: true, image: true, fields: true },
      });
    }
    if (!template) {
      template = await prisma.verificationTemplate.findFirst({
        where: { isActive: true },
        select: { id: true, name: true, image: true, fields: true },
      });
    }
    result = await preliminaryReview(photo, template as any);
  }

  if (!result) {
    // AI 调用失败, 转入人工复审
    await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: VerificationStatus.PENDING },
    });
    return;
  }
  if (result.isIdCard && result.isClear) {
    // AI 初审通过, 等待人工复审
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: VerificationStatus.PENDING,
        verificationAiResult: result as any,
      },
    });
  } else {
    // AI 初审驳回
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        verificationRejectReason: result.rejectReason || (isFace ? '未检测到人脸或照片不清晰' : '照片不符合要求 (非校园卡或不清晰)'),
        verificationAiResult: result as any,
      },
    });
  }
}
