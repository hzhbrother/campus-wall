// POST /api/notifications/unread-count  未读数量
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getUnreadCount } from '@/lib/notification-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const count = await getUnreadCount(me.id);
    return NextResponse.json({ count });
  } catch (e) {
    return errorResponse(e);
  }
}
