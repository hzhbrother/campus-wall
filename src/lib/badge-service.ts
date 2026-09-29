// 勋章服务: 检查条件并授予勋章
import { prisma } from './prisma';
import { createNotification } from './notification-service';

export type BadgeConditionType =
  | 'POST_COUNT' | 'LIKE_COUNT' | 'COMMENT_COUNT' | 'CHECKIN_DAYS' | 'POINTS' | 'MANUAL'
  // 行为徽章
  | 'NIGHT_OWL'    // 守夜冠军: 连续N天凌晨2-4点发帖/评论
  | 'HOT_POST'     // 爆款制造机: 单条帖子点赞数达到N
  | 'TOP_COMMENT'  // 吃瓜一线: 评论被点赞达到N
  | 'HELPER';      // 暖心学姐: 求助问答板块获赞达到N

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

  // 连续签到天数
  let streak = 0;
  const dates = new Set(user.checkIns.map(c => c.date));
  const today = new Date();
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) streak++;
    else break;
  }

  // ---- 行为徽章统计 ----

  // 守夜冠军: 最近3天, 每天都有凌晨2-4点的帖子或评论
  const nightOwlStreak = await getNightOwlStreak(userId);

  // 爆款制造机: 单条帖子最大获赞数
  const topPost = await prisma.post.findFirst({
    where: { authorId: userId },
    orderBy: { likes: { _count: 'desc' } },
    select: { id: true, _count: { select: { likes: true } } },
  });
  const maxSinglePostLikes = topPost?._count?.likes || 0;

  // 吃瓜一线: 被点赞最多的评论的获赞数
  const topComment = await prisma.comment.findFirst({
    where: { authorId: userId },
    orderBy: { likes: { _count: 'desc' } },
    select: { id: true, _count: { select: { likes: true } } },
  });
  const maxCommentLikes = topComment?._count?.likes || 0;

  // 暖心学姐: 求助问答板块帖子获赞数
  const helperLikes = await prisma.like.count({
    where: { post: { authorId: userId, category: '求助问答' } },
  });

  const stats: Record<string, number> = {
    POST_COUNT: user._count.posts,
    LIKE_COUNT: likesReceived,
    COMMENT_COUNT: user._count.comments,
    CHECKIN_DAYS: streak,
    POINTS: user.points,
    MANUAL: 0,
    NIGHT_OWL: nightOwlStreak,
    HOT_POST: maxSinglePostLikes,
    TOP_COMMENT: maxCommentLikes,
    HELPER: helperLikes,
  };

  const activeBadges = await prisma.badge.findMany({ where: { isActive: true } });
  const newlyAwarded: { id: string; name: string; icon?: string | null; description?: string | null }[] = [];

  for (const badge of activeBadges) {
    if (badge.conditionType === 'MANUAL') continue;
    const current = stats[badge.conditionType] ?? 0;
    if (current >= badge.threshold) {
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

// 守夜冠军: 连续N天在凌晨2-4点有发帖/评论
async function getNightOwlStreak(userId: string): Promise<number> {
  // 查最近30天的帖子和评论, 按天分组, 筛凌晨2-4点
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  // 合并所有时间, 筛出凌晨2-4点, 按天去重
  const nightDates = new Set<string>();
  for (const p of posts) {
    const h = p.createdAt.getHours();
    if (h >= 2 && h < 4) nightDates.add(p.createdAt.toISOString().slice(0, 10));
  }
  for (const c of comments) {
    const h = c.createdAt.getHours();
    if (h >= 2 && h < 4) nightDates.add(c.createdAt.toISOString().slice(0, 10));
  }

  // 计算从今天往回的连续天数
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (nightDates.has(key)) streak++;
    else break;
  }
  return streak;
}

// 获取用户已获得的勋章
export async function getUserBadges(userId: string) {
  return prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' },
  });
}
