// POST /api/users/me/verification  提交实名认证申请 (上传校园卡照片)
// GET  /api/users/me/verification  查询当前认证状态
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { VerificationStatus } from '@prisma/client';

// 校园卡照片上限 5MB (base64 后约 6.7MB)
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const SubmitSchema = z.object({
  photo: z.string().min(1).max(Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 100),
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

    const updated = await prisma.user.update({
      where: { id: me.id },
      data: {
        verificationPhoto: dto.photo,
        verificationStatus: VerificationStatus.PENDING,
        verificationRejectReason: null,
      },
      select: {
        verified: true,
        verificationStatus: true,
        verificationRejectReason: true,
      },
    });

    return NextResponse.json({
      message: '认证申请已提交, 等待管理员审核',
      ...updated,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
