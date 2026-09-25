// POST /api/admin/posts/:id/reject  驳回 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { reject } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const { reason, violationType } = await req.json().catch(() => ({}));
    return NextResponse.json(await reject(params.id, me.id, reason, violationType));
  } catch (e) {
    return errorResponse(e);
  }
}
