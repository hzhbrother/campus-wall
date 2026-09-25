// 管理后台业务逻辑
import { UserRole, UserStatus, PostStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function stats() {
  const [users, posts, pendingPosts, comments, paidOrders, revenueAgg] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.post.count({ where: { status: PostStatus.PENDING } }),
    prisma.comment.count(),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
  ]);
  return { users, posts, pendingPosts, comments, paidOrders, revenueCents: revenueAgg._sum.amount || 0 };
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
  return updated;
}

export async function reject(postId: string, actorId: string, reason?: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('帖子不存在');
  const updated = await prisma.post.update({ where: { id: postId }, data: { status: PostStatus.REJECTED } });
  await audit(actorId, 'REJECT_POST', postId, reason);
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

// 支付明细：列出所有订单（含用户、支付方式、金额、时间）
export async function listOrders(page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, nickname: true, email: true } } },
    }),
    prisma.order.count(),
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
      select: { id: true, email: true, nickname: true, realName: true, avatar: true, role: true, status: true, grade: true, className: true, remark: true, createdAt: true, _count: { select: { posts: true } } },
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
}, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');
  const updated = await prisma.user.update({ where: { id: userId }, data });
  await audit(actorId, 'UPDATE_USER', userId);
  return updated;
}

async function audit(actorId: string, action: string, target: string, detail?: string) {
  await prisma.auditLog.create({ data: { actorId, action, target, detail } });
}
