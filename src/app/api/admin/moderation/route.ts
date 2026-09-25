// GET /api/admin/moderation  审核队列 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { moderationQueue } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    return NextResponse.json(await moderationQueue(page, pageSize));
  } catch (e) {
    return errorResponse(e);
  }
}
