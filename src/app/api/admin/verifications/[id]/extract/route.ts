// POST /api/admin/verifications/[id]/extract  AI 识图提取校园卡关键信息 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { extractIdInfo, isVisionEnabled } from '@/lib/ai-vision';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'user.edit');
    if (!isVisionEnabled()) {
      return NextResponse.json({ message: '未配置 AI 视觉识别, 请手动审核' }, { status: 503 });
    }
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { verificationPhoto: true },
    });
    if (!user?.verificationPhoto) {
      return NextResponse.json({ message: '该用户未上传认证照片' }, { status: 400 });
    }
    const result = await extractIdInfo(user.verificationPhoto);
    if (!result) {
      return NextResponse.json({ message: 'AI 识别失败, 请手动审核' }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
