// GET /api/admin/juhe-test  测试服务器到聚合登录接口的连通性 (管理员)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { testJuheConnection } from '@/lib/aggregated-login';

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const result = await testJuheConnection();
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ message: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, message: e?.message || '测试失败' });
  }
}
