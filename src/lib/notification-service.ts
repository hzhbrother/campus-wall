// 通知服务: 创建通知 + 邮件推送
import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { sendEmail } from './email-service';

export interface CreateNotificationOptions {
  userId?: string | null;       // null = 广播给所有人
  type?: NotificationType;
  title: string;
  content: string;
  link?: string;
  sendEmail?: boolean;          // 是否同时发邮件
  targetRole?: UserRole;       // 按角色发送
  pinned?: boolean;            // 强调/置顶
}

// 创建通知 (单条或批量)
export async function createNotification(opts: CreateNotificationOptions) {
  const { userId, type = NotificationType.SYSTEM, title, content, link, sendEmail: doEmail = false, targetRole, pinned = false } = opts;

  // 目标用户列表
  let userIds: string[] = [];
  if (userId) {
    userIds = [userId];
  } else if (targetRole) {
    const users = await prisma.user.findMany({ where: { role: targetRole, status: 'NORMAL' }, select: { id: true } });
    userIds = users.map(u => u.id);
  } else {
    // 全体广播: 创建一条 userId=null 的广播通知
    await prisma.notification.create({ data: { type, title, content, link, userId: null, pinned } });
    if (doEmail) await broadcastEmail(title, content, null);
    return;
  }

  // 为每个用户创建通知
  const notifications = userIds.map(uid => ({
    type, title, content, link, userId: uid, pinned,
  }));
  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  // 邮件推送
  if (doEmail && userIds.length > 0) {
    await broadcastEmail(title, content, userIds);
  }
}

// 批量发送邮件
async function broadcastEmail(title: string, content: string, userIds: string[] | null) {
  const where = userIds ? { id: { in: userIds }, email: { not: null } } : { email: { not: null } };
  const users = await prisma.user.findMany({ where, select: { email: true, nickname: true } });
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <h2 style="color:#3b82f6;">${title}</h2>
      <p style="color:#374151;line-height:1.6;">${content.replace(/\n/g, '<br>')}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
      <p style="color:#9ca3af;font-size:12px;">此邮件由校园墙系统自动发送，请勿直接回复。</p>
    </div>`;
  for (const u of users) {
    if (u.email) await sendEmail(u.email, `[校园墙] ${title}`, html);
  }
}

// 获取用户未读数量
export async function getUnreadCount(userId: string): Promise<number> {
  const [personal, broadcast] = await Promise.all([
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.count({ where: { userId: null } }),
  ]);
  // 广播通知的已读状态简化处理: 假设都算未读 (实际可加 NotificationRead 表)
  return personal + broadcast;
}

// 获取用户通知列表 (个人 + 广播)
export async function listUserNotifications(userId: string, page = 1, pageSize = 20, onlyUnread = false) {
  const where: any = { OR: [{ userId }, { userId: null }] };
  if (onlyUnread) where.isRead = false;
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// 标记为已读
export async function markAsRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, OR: [{ userId }, { userId: null }] },
    data: { isRead: true },
  });
}

// 全部标记已读
export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
