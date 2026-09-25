// POST /api/notifications/read-all  全部标记已读
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { markAllAsRead } from '@/lib/notification-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    await markAllAsRead(me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
