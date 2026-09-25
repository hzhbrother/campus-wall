// GET/PATCH /api/users/me/notification-settings  用户通知偏好
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    let setting = await prisma.notificationSetting.findUnique({ where: { userId: me.id } });
    if (!setting) {
      setting = await prisma.notificationSetting.create({ data: { userId: me.id } });
    }
    return NextResponse.json(setting);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await req.json();
    const data: any = {};
    if (typeof body.emailNotify === 'boolean') data.emailNotify = body.emailNotify;
    if (typeof body.systemNotify === 'boolean') data.systemNotify = body.systemNotify;
    if (typeof body.commentNotify === 'boolean') data.commentNotify = body.commentNotify;
    if (typeof body.likeNotify === 'boolean') data.likeNotify = body.likeNotify;
    const setting = await prisma.notificationSetting.upsert({
      where: { userId: me.id },
      update: data,
      create: { userId: me.id, ...data },
    });
    return NextResponse.json(setting);
  } catch (e) {
    return errorResponse(e);
  }
}
