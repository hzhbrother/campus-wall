// GET /api/users/me/badges  当前用户已获得的勋章
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getUserBadges } from '@/lib/badge-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const items = await getUserBadges(me.id);
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
