// 诚信分服务
import { prisma } from '@/lib/prisma';

const MAX_SCORE = 100;
const RECOVERY_PER_WEEK = 10; // 每周恢复 10 分
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 违规类型对应的扣分
export const VIOLATION_POINTS: Record<string, number> = {
  SPAM: 10,        // 垃圾广告
  ABUSE: 20,       // 辱骂攻击
  PORN: 30,        // 色情低俗
  ILLEGAL: 50,     // 违法违规
  PLAGIARISM: 15,  // 抄袭侵权
};

// 计算用户当前诚信分
export async function getCurrentScore(userId: string): Promise<number> {
  const violations = await prisma.violationRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return computeScore(violations.map(v => ({ date: v.createdAt, points: v.pointsDeducted })));
}

// 根据违规记录列表计算当前分数
function computeScore(violations: { date: Date; points: number }[]): number {
  if (violations.length === 0) return MAX_SCORE;

  let score = MAX_SCORE;
  let lastViolationDate = new Date(0);

  for (const v of violations) {
    // 违规之间的恢复
    if (lastViolationDate.getTime() > 0) {
      const weeks = Math.floor((v.date.getTime() - lastViolationDate.getTime()) / WEEK_MS);
      score = Math.min(MAX_SCORE, score + weeks * RECOVERY_PER_WEEK);
    }
    // 扣除本次违规分数
    score = Math.max(0, score - v.points);
    lastViolationDate = v.date;
  }

  // 从最后一次违规到现在的恢复
  const now = Date.now();
  const weeksSinceLast = Math.floor((now - lastViolationDate.getTime()) / WEEK_MS);
  score = Math.min(MAX_SCORE, score + weeksSinceLast * RECOVERY_PER_WEEK);

  return score;
}

// 生成最近 N 天的诚信分折线图数据点
export async function getScoreChartData(userId: string, days = 30): Promise<{ date: string; score: number }[]> {
  const violations = await prisma.violationRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  // 只保留时间范围内的违规
  const relevant = violations.filter(v => v.createdAt >= start);

  const points: { date: string; score: number }[] = [];
  let score = MAX_SCORE;
  let lastViolationDate: Date | null = null;

  // 计算起始分数 (考虑起始日期之前的违规)
  const beforeStart = violations.filter(v => v.createdAt < start);
  if (beforeStart.length > 0) {
    score = computeScore(beforeStart.map(v => ({ date: v.createdAt, points: v.pointsDeducted })));
    lastViolationDate = beforeStart[beforeStart.length - 1].createdAt;
  }

  // 按天生成数据点
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    // 当天的违规
    const dayViolations = relevant.filter(v => v.createdAt >= dayStart && v.createdAt <= dayEnd);
    for (const v of dayViolations) {
      // 恢复
      if (lastViolationDate) {
        const weeks = Math.floor((v.createdAt.getTime() - lastViolationDate.getTime()) / WEEK_MS);
        score = Math.min(MAX_SCORE, score + weeks * RECOVERY_PER_WEEK);
      }
      score = Math.max(0, score - v.pointsDeducted);
      lastViolationDate = v.createdAt;
    }

    // 当天无违规, 检查是否需要恢复
    if (dayViolations.length === 0 && lastViolationDate) {
      const weeks = Math.floor((dayEnd.getTime() - lastViolationDate.getTime()) / WEEK_MS);
      if (weeks > 0) {
        score = Math.min(MAX_SCORE, score + weeks * RECOVERY_PER_WEEK);
        lastViolationDate = new Date(lastViolationDate.getTime() + weeks * WEEK_MS);
      }
    }

    points.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      score,
    });
  }

  return points;
}

// 记录违规并扣分
// pointsDeducted: 自定义扣分 (5-100), 不传则按违规类型默认扣分
export async function recordViolation(
  userId: string,
  type: string,
  reason: string,
  relatedPostId?: string,
  pointsDeducted?: number
): Promise<{ newScore: number; deducted: number }> {
  // 自定义扣分优先, 否则按违规类型默认扣分; 限制在 5-100 之间
  const defaultPoints = VIOLATION_POINTS[type] || 10;
  const points = pointsDeducted != null
    ? Math.min(100, Math.max(5, Math.round(pointsDeducted)))
    : defaultPoints;
  await prisma.violationRecord.create({
    data: { userId, type, reason, pointsDeducted: points, relatedPostId },
  });
  const newScore = await getCurrentScore(userId);
  // 同步更新用户表的诚信分, 保证实时一致
  await prisma.user.update({ where: { id: userId }, data: { credibilityScore: newScore } });
  return { newScore, deducted: points };
}
