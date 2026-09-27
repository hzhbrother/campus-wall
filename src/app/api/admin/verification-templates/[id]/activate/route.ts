// POST /api/admin/verification-templates/[id]/activate  激活模板 (允许多个同时激活)
// POST /api/admin/verification-templates/[id]/deactivate  停用模板
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'template.manage');
    // 只激活当前模板, 不影响其他模板 (允许多个同时激活)
    const tpl = await prisma.verificationTemplate.update({
      where: { id: params.id },
      data: { isActive: true },
    });
    return NextResponse.json({ message: '已激活', template: tpl });
  } catch (e) {
    return errorResponse(e);
  }
}
