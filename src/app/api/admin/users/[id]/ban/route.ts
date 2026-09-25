// POST /api/admin/users/:id/ban  封禁用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { banUser, unbanUser } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const { durationDays, reason, violationType, durationHours, pointsDeducted } = await req.json().catch(() => ({}));
    if (typeof durationDays !== 'number') {
      return NextResponse.json({ message: '缺少封禁时长' }, { status: 400 });
    }
    const user = await banUser(
      params.id,
      durationDays,
      reason || '',
      me.id,
      violationType || 'SPAM',
      { durationHours: durationHours || 0, pointsDeducted }
    );
    return NextResponse.json(user);
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/admin/users/:id/ban  解封用户
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const user = await unbanUser(params.id, me.id);
    return NextResponse.json(user);
  } catch (e) {
    return errorResponse(e);
  }
}
