// GET /api/verification-templates  公开的学校模板列表 (供用户提交认证时选择学校)
// 只返回 id + name, 不返回图片和框选字段 (管理员私有数据)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    const templates = await prisma.verificationTemplate.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    });
    return NextResponse.json({ templates });
  } catch (e) {
    return errorResponse(e);
  }
}
