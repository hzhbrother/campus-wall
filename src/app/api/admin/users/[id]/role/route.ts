// PATCH /api/admin/users/:id/role  设置用户角色 (SUPER_ADMIN only)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { setRole } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.SUPER_ADMIN);
    const { role } = await req.json();
    if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ message: '非法角色' }, { status: 400 });
    }
    return NextResponse.json(await setRole(params.id, role as UserRole, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
