// POST /api/admin/posts/:id/approve  通过审核 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requirePermission } from '@/lib/server-auth';
import { approve } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requirePermission(req, 'post.moderate');
    return NextResponse.json(await approve(params.id, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
