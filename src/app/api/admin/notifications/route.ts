// POST /api/admin/notifications  管理员发布通知
// GET  /api/admin/notifications  获取通知列表 (历史记录)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole, NotificationType } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { createNotification } from '@/lib/notification-service';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  type: z.enum(['SYSTEM', 'POST', 'COMMENT', 'LIKE', 'ANNOUNCE']).default('ANNOUNCE'),
  target: z.enum(['ALL', 'ROLE', 'USERS']).default('ALL'),
  role: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  sendEmail: z.boolean().default(false),
  pinned: z.boolean().default(false),
  link: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    // 获取所有通知 (按时间倒序, 置顶优先)
    const items = await prisma.notification.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const dto = Schema.parse(await req.json());

    let targetRole: UserRole | undefined;
    if (dto.target === 'ROLE' && dto.role) targetRole = dto.role as UserRole;

    let userId: string | null | undefined;
    if (dto.target === 'USERS' && dto.userIds?.length) {
      for (const uid of dto.userIds) {
        await createNotification({
          userId: uid,
          type: dto.type as NotificationType,
          title: dto.title,
          content: dto.content,
          link: dto.link,
          sendEmail: dto.sendEmail,
          pinned: dto.pinned,
        });
      }
    } else {
      await createNotification({
        userId: dto.target === 'ALL' ? null : undefined,
        targetRole,
        type: dto.type as NotificationType,
        title: dto.title,
        content: dto.content,
        link: dto.link,
        sendEmail: dto.sendEmail,
        pinned: dto.pinned,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
