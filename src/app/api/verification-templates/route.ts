// GET /api/verification-templates  公开的认证模板列表 (供用户提交认证时选择)
// 支持 ?type=STUDENT|TEACHER|QUALIFICATION 按类型过滤
// 返回 id, name, type, image (案例图), isActive
import { NextRequest, NextResponse } from 'next/server';
import { VerificationTemplateType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const type = sp.get('type') as VerificationTemplateType | null;

    const where: any = {};
    if (type && Object.values(VerificationTemplateType).includes(type)) {
      where.type = type;
    }

    const templates = await prisma.verificationTemplate.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, type: true, image: true, isActive: true },
    });
    return NextResponse.json({ templates });
  } catch (e) {
    return errorResponse(e);
  }
}
