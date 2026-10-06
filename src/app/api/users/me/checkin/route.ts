// GET  /api/users/me/checkin  签到状态
// POST /api/users/me/checkin  签到 (获得积分)
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { checkAndAwardBadges } from '@/lib/badge-service';
import { errorResponse } from '@/lib/api-response';

// 北京时间 (UTC+8) 当日日期字符串 YYYY-MM-DD, 以 0 点为切换点
function cnDateStr(d: Date = new Date()) {
  const cn = new Date(d.getTime() + 8 * 3600 * 1000);
  return cn.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const today = cnDateStr();
    const checked = await prisma.checkInRecord.findUnique({ where: { userId_date: { userId: me.id, date: today } } });
    // 连续签到天数 (按北京自然日)
    const records = await prisma.checkInRecord.findMany({ where: { userId: me.id }, select: { date: true }, orderBy: { date: 'desc' }, take: 400 });
    const dates = new Set(records.map(r => r.date));
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 400; i++) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      if (dates.has(cnDateStr(d))) streak++;
      else break;
    }
    // 本月已签到日期 (按北京自然日所在月份)
    const [y, m] = today.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-31`;
    const monthRecords = await prisma.checkInRecord.findMany({
      where: { userId: me.id, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true },
    });
    const monthSignedDays = monthRecords.map(r => r.date);
    const user = await prisma.user.findUnique({ where: { id: me.id }, select: { points: true } });
    return NextResponse.json({ checkedIn: !!checked, streak, points: user?.points || 0, today, monthSignedDays });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const today = cnDateStr();
    const existing = await prisma.checkInRecord.findUnique({ where: { userId_date: { userId: me.id, date: today } } });
    if (existing) return NextResponse.json({ message: '今日已签到', checkedIn: true }, { status: 400 });

    // 计算连续签到天数 (含今天, 按北京自然日)
    const records = await prisma.checkInRecord.findMany({ where: { userId: me.id }, select: { date: true }, orderBy: { date: 'desc' }, take: 400 });
    const dates = new Set(records.map(r => r.date));
    let streak = 0;
    const now = new Date();
    for (let i = 1; i <= 400; i++) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      if (dates.has(cnDateStr(d))) streak++;
      else break;
    }
    streak += 1; // 含今天

    // 连续签到积分梯度 (与前端 REWARD_RULES 保持一致)
    const points =
      streak >= 100 ? 12 :
      streak >= 30  ? 8  :
      streak >= 15  ? 5  :
      streak >= 7   ? 3  :
      streak >= 3   ? 2  : 1;

    await prisma.checkInRecord.create({ data: { userId: me.id, date: today, points } });
    const updated = await prisma.user.update({ where: { id: me.id }, data: { points: { increment: points } }, select: { points: true } });

    // 检查勋章 (出错不影响签到结果)
    let newBadges: any[] = [];
    try {
      newBadges = await checkAndAwardBadges(me.id);
    } catch (e) {
      console.error('checkAndAwardBadges error:', e);
    }

    return NextResponse.json({ checkedIn: true, streak, earnedPoints: points, totalPoints: updated.points, newBadges });
  } catch (e) {
    return errorResponse(e);
  }
}
