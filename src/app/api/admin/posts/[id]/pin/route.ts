// POST /api/admin/posts/:id/pin  置顶/取消 (ADMIN / SUPER_ADMIN / TEACHER)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { setPinned } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER);
    const { pinned } = await req.json().catch(() => ({ pinned: true }));
    return NextResponse.json(await setPinned(params.id, pinned ?? true, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
