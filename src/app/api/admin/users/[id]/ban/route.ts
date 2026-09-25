// POST /api/admin/users/:id/status  设置用户状态 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { setStatus } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const { status } = await req.json().catch(() => ({}));
    if (!['NORMAL', 'GRADUATED', 'BANNED'].includes(status)) {
      return NextResponse.json({ message: '非法状态' }, { status: 400 });
    }
    return NextResponse.json(await setStatus(params.id, status as UserStatus, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
