// GET /api/admin/stats  概览 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { stats } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    return NextResponse.json(await stats());
  } catch (e) {
    return errorResponse(e);
  }
}
