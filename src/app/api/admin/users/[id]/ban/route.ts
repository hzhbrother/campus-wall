// POST /api/admin/users/:id/ban  封禁/解封 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { setBanned } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const { banned } = await req.json().catch(() => ({ banned: true }));
    return NextResponse.json(await setBanned(params.id, banned ?? true, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
