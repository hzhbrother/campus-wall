// POST /api/admin/verification-templates/[id]/deactivate  停用模板
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'template.manage');
    const tpl = await prisma.verificationTemplate.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ message: '已停用', template: tpl });
  } catch (e) {
    return errorResponse(e);
  }
}
