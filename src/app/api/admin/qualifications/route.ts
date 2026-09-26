// GET   /api/admin/qualifications  资质/荣誉认证审核列表 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'user.edit');
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status') || 'PENDING'; // PENDING | ALL | APPROVED | REJECTED
    const category = sp.get('category') || ''; // QUALIFICATION | HONOR | ''

    const where: any = {};
    if (status !== 'ALL') {
      where.status = status;
    } else {
      where.status = { in: ['PENDING', 'APPROVED', 'REJECTED'] };
    }
    if (category) where.category = category;

    const items = await prisma.qualification.findMany({
      where,
      orderBy: status === 'PENDING' ? { createdAt: 'asc' } : { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true, nickname: true, avatar: true, realName: true,
            role: true, grade: true, className: true,
          },
        },
      },
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
