// 通知服务: 创建通知 + 邮件推送
import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { sendEmail } from './email-service';
import { getTemplate, renderTemplate } from './email-templates';

export interface CreateNotificationOptions {
  userId?: string | null;       // null = 广播给所有人
  type?: NotificationType;
  title: string;
  content: string;
  link?: string;
  sendEmail?: boolean;          // 是否同时发邮件
  targetRole?: UserRole;       // 按角色发送
  pinned?: boolean;            // 强调/置顶
  /** 邮件模板专用数据 (如 postTitle, reason 等) */
  templateData?: Record<string, any>;
}

// 通知类型 -> 邮件模板 key 映射
const TYPE_TEMPLATE_MAP: Partial<Record<NotificationType, string>> = {
  [NotificationType.SYSTEM]: 'notification.generic',
  [NotificationType.ANNOUNCE]: 'notification.generic',
  [NotificationType.POST]: 'post.approved',   // 默认走审核通过, 调用方可通过 templateData 切换
  [NotificationType.COMMENT]: 'comment.reply',
  [NotificationType.LIKE]: 'post.liked',
  [NotificationType.BAN]: 'user.banned',
};

// 创建通知 (单条或批量)
export async function createNotification(opts: CreateNotificationOptions) {
  const { userId, type = NotificationType.SYSTEM, title, content, link, sendEmail: doEmail = false, targetRole, pinned = false, templateData } = opts;

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
    if (doEmail) await broadcastEmail(type, title, content, link, null, templateData);
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
    await broadcastEmail(type, title, content, link, userIds, templateData);
  }
}

// 获取站点名称
async function getSiteName(): Promise<string> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'site_name' } });
  return row?.value || '校园墙';
}

// 批量发送邮件 (按通知类型选择模板)
async function broadcastEmail(
  type: NotificationType,
  title: string,
  content: string,
  link: string | undefined,
  userIds: string[] | null,
  templateData?: Record<string, any>
) {
  const where = userIds ? { id: { in: userIds }, email: { not: null } } : { email: { not: null } };
  const users = await prisma.user.findMany({ where, select: { email: true, nickname: true } });
  if (users.length === 0) return;

  const siteName = await getSiteName();
  // 优先使用调用方指定的模板, 否则按通知类型映射, 最后回退通用模板
  const tplKey = templateData?._templateKey || TYPE_TEMPLATE_MAP[type] || 'notification.generic';
  const template = await getTemplate(tplKey);

  // 模板变量: 合并通用变量 + 业务数据
  const vars: Record<string, any> = {
    siteName,
    title,
    message: content.replace(/\n/g, '<br>'),
    actionUrl: link,
    actionText: '查看详情',
    nickname: '', // 单条发送时会覆盖
    ...(templateData || {}),
  };

  for (const u of users) {
    if (!u.email) continue;
    const userVars = { ...vars, nickname: u.nickname || '同学' };
    const subject = template ? renderTemplate(template.subject, userVars) : `【${siteName}】${title}`;
    const html = template ? renderTemplate(template.html, userVars) : content;
    await sendEmail(u.email, subject, html);
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
