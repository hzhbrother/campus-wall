// POST /api/admin/verification-templates/[id]/activate  设为唯一激活模板 (超级管理员)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    // 先把所有模板设为非激活
    await prisma.verificationTemplate.updateMany({ data: { isActive: false } });
    // 再激活当前模板
    const tpl = await prisma.verificationTemplate.update({
      where: { id: params.id },
      data: { isActive: true },
    });
    return NextResponse.json({ message: '已设为激活模板', template: tpl });
  } catch (e) {
    return errorResponse(e);
  }
}
