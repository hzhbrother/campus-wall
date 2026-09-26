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
      select: { verificationPhoto: true, verificationTemplateId: true },
    });
    if (!user?.verificationPhoto) {
      return NextResponse.json({ message: '该用户未上传认证照片' }, { status: 400 });
    }
    // 优先用用户选择的学校模板, 没选则用全局激活的模板
    let template: any = null;
    if (user.verificationTemplateId) {
      template = await prisma.verificationTemplate.findUnique({
        where: { id: user.verificationTemplateId },
        select: { id: true, name: true, image: true, fields: true },
      });
    }
    if (!template) {
      template = await prisma.verificationTemplate.findFirst({
        where: { isActive: true },
        select: { id: true, name: true, image: true, fields: true },
      });
    }
    const result = await extractIdInfo(user.verificationPhoto, template as any);
    if (!result) {
      return NextResponse.json({ message: 'AI 识别失败, 请手动审核' }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
