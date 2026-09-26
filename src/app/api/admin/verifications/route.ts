// GET /api/admin/verifications  实名认证审核列表 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'user.edit');
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status') || 'PENDING'; // PENDING | APPROVED | REJECTED | ALL

    const where: any = {};
    if (status !== 'ALL') {
      where.verificationStatus = status;
    } else {
      where.verificationStatus = { in: ['AI_REVIEWING', 'PENDING', 'APPROVED', 'REJECTED'] };
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: status === 'PENDING' ? { createdAt: 'asc' } : { updatedAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        realName: true,
        studentId: true,
        grade: true,
        className: true,
        role: true,
        verified: true,
        verifiedAt: true,
        verificationPhoto: true,
        verificationTemplateId: true,
        verificationStatus: true,
        verificationRejectReason: true,
        verificationAiResult: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 100,
    });

    return NextResponse.json({ items: users });
  } catch (e) {
    return errorResponse(e);
  }
}
