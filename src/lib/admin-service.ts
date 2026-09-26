// 管理后台业务逻辑
import { UserRole, UserStatus, PostStatus, VerificationStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// 违规类型标签映射
export const VIOLATION_TYPE_LABEL: Record<string, string> = {
  SPAM: '垃圾广告', ABUSE: '辱骂攻击', PORN: '色情低俗',
  ILLEGAL: '违法违规', PLAGIARISM: '抄袭侵权',
};

export function violationTypeLabel(type: string): string {
  // 预设类型返回中文标签, 自定义类型直接返回原文
  return VIOLATION_TYPE_LABEL[type] || type || '违规';
}

export async function stats() {
  const [users, posts, pendingPosts, comments] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.post.count({ where: { status: PostStatus.PENDING } }),
    prisma.comment.count(),
  ]);
  return { users, posts, pendingPosts, comments };
}

export async function moderationQueue(page: number, pageSize: number) {
  const where = { status: PostStatus.PENDING };
  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { author: { select: { id: true, nickname: true, avatar: true } } },
    }),
    prisma.post.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function approve(postId: string, actorId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('帖子不存在');
  const updated = await prisma.post.update({ where: { id: postId }, data: { status: PostStatus.APPROVED } });
  await audit(actorId, 'APPROVE_POST', postId);

  // 发送审核通过通知 (邮件 + 站内)
  if (post.authorId) {
    const { createNotification } = await import('@/lib/notification-service');
    const { NotificationType } = await import('@prisma/client');
    await createNotification({
      userId: post.authorId,
      type: NotificationType.POST,
      title: '帖子审核通过',
      content: `您发布的帖子「${post.title}」已通过审核，现已公开发布。`,
      link: `/post/${postId}`,
      sendEmail: true,
      templateData: { _templateKey: 'post.approved', postTitle: post.title, postUrl: `/post/${postId}` },
    });
  }
  return updated;
}

export async function reject(postId: string, actorId: string, reason?: string, violationType?: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { author: { select: { id: true, nickname: true } } } });
  if (!post) throw new Error('帖子不存在');
  const updated = await prisma.post.update({ where: { id: postId }, data: { status: PostStatus.REJECTED } });
  await audit(actorId, 'REJECT_POST', postId, reason);

  // 驳回帖子时同步创建违规记录并扣除诚信分
  if (violationType && post.author) {
    const { recordViolation, VIOLATION_POINTS } = await import('@/lib/credibility-service');
    const vLabel = violationTypeLabel(violationType);
    const points = VIOLATION_POINTS[violationType] || 10;
    const { newScore } = await recordViolation(post.author.id, violationType, `帖子「${post.title}」因「${reason || vLabel}」被驳回`, postId);
    // 发送驳回通知 (使用 post.rejected 模板)
    const { createNotification } = await import('@/lib/notification-service');
    const { NotificationType } = await import('@prisma/client');
    await createNotification({
      userId: post.author.id,
      type: NotificationType.POST,
      title: '帖子审核驳回',
      content: `您发布的帖子「${post.title}」因「${reason || vLabel}」被驳回, 已扣除诚信分 ${points} 分, 当前诚信分 ${newScore} 分。`,
      link: `/post/${postId}`,
      sendEmail: true,
      templateData: { _templateKey: 'post.rejected', postTitle: post.title, reason: reason || vLabel },
    });
  }
  return updated;
}

export async function setPinned(postId: string, pinned: boolean, actorId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('帖子不存在');
  const updated = await prisma.post.update({ where: { id: postId }, data: { pinned } });
  await audit(actorId, pinned ? 'PIN_POST' : 'UNPIN_POST', postId);
  return updated;
}

// 帖子管理：列出所有帖子（含作者、状态）
export async function listPosts(page: number, pageSize: number, status?: PostStatus, kw?: string) {
  const where: Prisma.PostWhereInput = {
    ...(status ? { status } : {}),
    ...(kw ? { OR: [{ title: { contains: kw } }, { content: { contains: kw } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { author: { select: { id: true, nickname: true, email: true } } },
    }),
    prisma.post.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// 评论管理：列出所有评论（含作者、所属帖子）
export async function listComments(page: number, pageSize: number, kw?: string) {
  const where: Prisma.CommentWhereInput = {
    ...(kw ? { content: { contains: kw } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { id: true, nickname: true, email: true } },
        post: { select: { id: true, title: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listUsers(page: number, pageSize: number, role?: UserRole, kw?: string) {
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(kw ? { OR: [{ nickname: { contains: kw } }, { email: { contains: kw } }, { realName: { contains: kw } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, nickname: true, realName: true, avatar: true, role: true, status: true, grade: true, className: true, remark: true, bannedUntil: true, banReason: true, credibilityScore: true, verified: true, verifiedAt: true, verificationStatus: true, verificationPhoto: true, verificationRejectReason: true, createdAt: true, _count: { select: { posts: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function setRole(userId: string, role: UserRole, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit(actorId, 'SET_ROLE', userId, `role=${role}`);
  return updated;
}

export async function setStatus(userId: string, status: UserStatus, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  await audit(actorId, 'SET_STATUS', userId, `status=${status}`);
  return updated;
}

// 管理员编辑用户资料
export async function updateUser(userId: string, data: {
  realName?: string;
  grade?: string;
  className?: string;
  remark?: string;
  avatar?: string;
  status?: UserStatus;
  role?: UserRole;
  bannedUntil?: Date | null;
  verified?: boolean;
  verifiedAt?: Date | null;
  verificationPhoto?: string | null;
  verificationStatus?: VerificationStatus;
  verificationRejectReason?: string | null;
}, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  // 若将状态设为永久封禁, 同步清空临时封禁到期时间, 保持字段一致
  if (data.status === UserStatus.BANNED) {
    data.bannedUntil = null;
  }
  const updated = await prisma.user.update({ where: { id: userId }, data });
  await audit(actorId, 'UPDATE_USER', userId);
  return updated;
}

// 封禁用户
// durationDays = 0 且 durationHours = 0 表示永久封禁
// pointsDeducted: 自定义扣分 (5-100), 不传则按违规类型默认扣分
export async function banUser(
  userId: string,
  durationDays: number,
  reason: string,
  actorId: string,
  violationType: string = 'SPAM',
  options?: { durationHours?: number; pointsDeducted?: number }
) {
  const durationHours = options?.durationHours || 0;
  const pointsDeducted = options?.pointsDeducted;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  const isPermanent = durationDays <= 0 && durationHours <= 0;
  const totalMs = (durationDays * 24 + durationHours) * 60 * 60 * 1000;
  const bannedUntil = isPermanent ? null : new Date(Date.now() + totalMs);
  const data: any = { banReason: reason || null };
  if (isPermanent) {
    data.status = UserStatus.BANNED;
    data.bannedUntil = null;
  } else {
    data.status = UserStatus.NORMAL;
    data.bannedUntil = bannedUntil;
  }
  const updated = await prisma.user.update({ where: { id: userId }, data });

  // 记录封禁记录
  const banRecord = await prisma.banRecord.create({
    data: {
      userId,
      reason: reason || '',
      durationDays,
      durationHours,
      bannedUntil,
      isPermanent,
    },
  });

  // 同步创建违规记录并扣除诚信分
  const { recordViolation, VIOLATION_POINTS } = await import('@/lib/credibility-service');
  const vLabel = violationTypeLabel(violationType);
  const { newScore, deducted } = await recordViolation(
    userId,
    violationType,
    `${reason || vLabel}（封禁${isPermanent ? '永久' : (durationDays > 0 ? durationDays + '天' : '') + (durationHours > 0 ? durationHours + '小时' : '')}）`,
    undefined,
    pointsDeducted
  );

  // 发送封禁通知到铃铛 (直接说明违规原因 + 扣除信用分)
  const { createNotification } = await import('@/lib/notification-service');
  const { NotificationType } = await import('@prisma/client');
  const banDurationText = isPermanent
    ? '永久封禁'
    : `封禁 ${durationDays > 0 ? durationDays + ' 天' : ''}${durationHours > 0 ? ' ' + durationHours + ' 小时' : ''}`.trim();
  await createNotification({
    userId,
    type: NotificationType.BAN,
    title: '账号违规通知',
    content: `您的账号已违规: 因「${vLabel}」${reason ? '（' + reason + '）' : ''}, 扣除诚信分 ${deducted} 分, 当前诚信分 ${newScore} 分。\n处罚措施: ${banDurationText}。\n如有异议, 可点击下方进行申诉。`,
    link: '/profile/ban-appeal',
    templateData: {
      reason: `${vLabel}${reason ? '（' + reason + '）' : ''}`,
      expiresAt: isPermanent ? '' : (user.bannedUntil ? new Date(user.bannedUntil).toLocaleString('zh-CN') : ''),
    },
  });

  await audit(actorId, 'BAN_USER', userId, isPermanent ? '永久封禁' : `封禁${durationDays}天${durationHours}小时`);
  return updated;
}

// 解封用户
export async function unbanUser(userId: string, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.NORMAL, bannedUntil: null, banReason: null },
  });
  // 标记最近一条封禁记录为已解封
  await prisma.banRecord.updateMany({
    where: { userId, liftedAt: null },
    data: { liftedAt: new Date(), liftedReason: '管理员解封' },
  });
  // 发送解封通知
  const { createNotification } = await import('@/lib/notification-service');
  const { NotificationType } = await import('@prisma/client');
  await createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title: '账号已解封',
    content: '您的账号已解除封禁, 可正常使用发帖、评论等功能。',
  });
  await audit(actorId, 'UNBAN_USER', userId);
  return updated;
}

// 删除用户 (级联删除)
export async function deleteUser(userId: string, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  await prisma.user.delete({ where: { id: userId } });
  await audit(actorId, 'DELETE_USER', userId, `nickname=${user.nickname}`);
  return { ok: true };
}

async function audit(actorId: string, action: string, target: string, detail?: string) {
  await prisma.auditLog.create({ data: { actorId, action, target, detail } });
}
