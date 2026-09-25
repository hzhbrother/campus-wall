// GET /api/notifications  获取当前用户通知列表
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { listUserNotifications } from '@/lib/notification-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const onlyUnread = url.searchParams.get('unread') === '1';
    const data = await listUserNotifications(me.id, page, pageSize, onlyUnread);
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
