// 勋章服务: 检查条件并授予勋章
import { prisma } from './prisma';
import { createNotification } from './notification-service';

export type BadgeConditionType = 'POST_COUNT' | 'LIKE_COUNT' | 'COMMENT_COUNT' | 'CHECKIN_DAYS' | 'POINTS' | 'MANUAL';

// 检查并授予用户满足条件的勋章, 返回新获得的勋章列表
export async function checkAndAwardBadges(userId: string): Promise<{ id: string; name: string; icon?: string | null; description?: string | null }[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, points: true,
      _count: { select: { posts: true, comments: true } },
      checkIns: { select: { date: true }, orderBy: { date: 'desc' }, take: 400 },
    },
  });
  if (!user) return [];

  // 获赞数
  const likesReceived = await prisma.like.count({ where: { post: { authorId: userId } } });

  // 连续签到天数 (以北京时间 0 点切换)
  let streak = 0;
  const dates = new Set(user.checkIns.map(c => c.date));
  const cnDateStr = (d: Date) => {
    const ms = d.getTime() + 8 * 3600 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  };
  const today = new Date();
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (dates.has(cnDateStr(d))) streak++;
    else break;
  }

  const stats: Record<BadgeConditionType, number> = {
    POST_COUNT: user._count.posts,
    LIKE_COUNT: likesReceived,
    COMMENT_COUNT: user._count.comments,
    CHECKIN_DAYS: streak,
    POINTS: user.points,
    MANUAL: 0,
  };

  const activeBadges = await prisma.badge.findMany({ where: { isActive: true } });
  const newlyAwarded: { id: string; name: string; icon?: string | null; description?: string | null }[] = [];

  for (const badge of activeBadges) {
    if (badge.conditionType === 'MANUAL') continue;
    const current = stats[badge.conditionType as BadgeConditionType] || 0;
    if (current >= badge.threshold) {
      // 检查是否已获得
      const existing = await prisma.userBadge.findUnique({ where: { userId_badgeId: { userId, badgeId: badge.id } } });
      if (!existing) {
        await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
        newlyAwarded.push({ id: badge.id, name: badge.name, icon: badge.icon, description: badge.description });
      }
    }
  }

  // 发送通知
  for (const b of newlyAwarded) {
    await createNotification({
      userId,
      title: '🎉 获得新勋章',
      content: `恭喜您获得「${b.name}」勋章！`,
      type: 'SYSTEM' as any,
    });
  }

  return newlyAwarded;
}

// 获取用户已获得的勋章
export async function getUserBadges(userId: string) {
  return prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' },
  });
}
