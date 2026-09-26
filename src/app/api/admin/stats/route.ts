// GET /api/admin/stats  概览 (任意拥有管理权限的用户)
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getUserPermissions } from '@/lib/server-auth';
import { stats } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    // 有任意一项管理权限即可查看概览
    const perms = await getUserPermissions(me);
    if (perms.size === 0) {
      return NextResponse.json({ message: '权限不足' }, { status: 403 });
    }
    return NextResponse.json(await stats());
  } catch (e) {
    return errorResponse(e);
  }
}
