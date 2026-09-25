// GET /api/admin/comments  评论管理列表 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { listComments } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    const q = sp.get('q') || undefined;
    return NextResponse.json(await listComments(page, pageSize, q));
  } catch (e) {
    return errorResponse(e);
  }
}
