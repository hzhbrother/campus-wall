// GET  /api/users/me/checkin  签到状态
// POST /api/users/me/checkin  签到 (获得积分)
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { checkAndAwardBadges } from '@/lib/badge-service';
import { errorResponse } from '@/lib/api-response';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const today = todayStr();
    const checked = await prisma.checkInRecord.findUnique({ where: { userId_date: { userId: me.id, date: today } } });
    // 连续签到天数
    const records = await prisma.checkInRecord.findMany({ where: { userId: me.id }, select: { date: true }, orderBy: { date: 'desc' }, take: 400 });
    const dates = new Set(records.map(r => r.date));
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 400; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) streak++;
      else break;
    }
    const user = await prisma.user.findUnique({ where: { id: me.id }, select: { points: true } });
    return NextResponse.json({ checkedIn: !!checked, streak, points: user?.points || 0 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const today = todayStr();
    const existing = await prisma.checkInRecord.findUnique({ where: { userId_date: { userId: me.id, date: today } } });
    if (existing) return NextResponse.json({ message: '今日已签到', checkedIn: true }, { status: 400 });

    // 计算连续签到天数 (含今天)
    const records = await prisma.checkInRecord.findMany({ where: { userId: me.id }, select: { date: true }, orderBy: { date: 'desc' }, take: 400 });
    const dates = new Set(records.map(r => r.date));
    let streak = 0;
    const now = new Date();
    for (let i = 1; i <= 400; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) streak++;
      else break;
    }
    streak += 1; // 含今天

    // 连续签到 7 天及以上得 2 分, 否则 1 分
    const points = streak >= 7 ? 2 : 1;

    await prisma.checkInRecord.create({ data: { userId: me.id, date: today, points } });
    await prisma.user.update({ where: { id: me.id }, data: { points: { increment: points } } });

    // 检查勋章
    const newBadges = await checkAndAwardBadges(me.id);

    return NextResponse.json({ checkedIn: true, streak, points, newBadges });
  } catch (e) {
    return errorResponse(e);
  }
}
