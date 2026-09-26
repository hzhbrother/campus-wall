// GET /api/admin/posts  帖子管理列表 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole, PostStatus } from '@prisma/client';
import { requirePermission } from '@/lib/server-auth';
import { listPosts } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'post.view');
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    const status = (sp.get('status') as PostStatus) || undefined;
    const q = sp.get('q') || undefined;
    return NextResponse.json(await listPosts(page, pageSize, status, q));
  } catch (e) {
    return errorResponse(e);
  }
}
