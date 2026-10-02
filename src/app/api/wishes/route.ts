// POST /api/wishes  提交许愿
// GET  /api/wishes  获取许愿列表 (公开, 按时间倒序)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { sendEmail } from '@/lib/email-service';

const CreateSchema = z.object({
  itemName: z.string().min(1, '请填写物品名称').max(50, '名称最多50字'),
  description: z.string().min(1, '请填写描述').max(500, '描述最多500字'),
  image: z.string().nullable().optional(),
});

export const dynamic = 'force-dynamic';

// POST: 提交许愿
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = CreateSchema.parse(await req.json());

    const wish = await prisma.wishItem.create({
      data: {
        userId: me.id,
        itemName: dto.itemName,
        description: dto.description,
        image: dto.image || null,
      },
      include: { user: { select: { nickname: true } } },
    });

    // 异步发邮件给管理员 (不阻塞响应)
    sendWishEmail(wish).catch(e => {
      console.error('[wish] 邮件发送失败', e?.message);
    });

    return NextResponse.json({ success: true, wish });
  } catch (e: any) {
    return errorResponse(e);
  }
}

// GET: 获取许愿列表
//   ?mine=1  只获取当前用户的许愿 (需登录)
//   不传    获取所有许愿 (公开, 按时间倒序)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);
  const mine = url.searchParams.get('mine') === '1';

  const where: any = {};
  if (mine) {
    const me = await requireUser(req);
    where.userId = me.id;
  }

  const wishes = await prisma.wishItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { nickname: true } } },
  });

  return NextResponse.json({ wishes });
}

// 发邮件给管理员
async function sendWishEmail(wish: any) {
  // 获取管理员邮箱
  const adminEmails = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { email: true },
  });
  const emails = adminEmails.map(u => u.email).filter(Boolean) as string[];
  if (emails.length === 0) return;

  const subject = `[许愿单] ${wish.itemName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f59e0b;">🎯 新的许愿提交</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 80px;">提交人</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${wish.user?.nickname || '匿名'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">物品名称</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${wish.itemName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">描述</td><td style="padding: 8px; border-bottom: 1px solid #eee; white-space: pre-wrap;">${wish.description}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">提交时间</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(wish.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td></tr>
      </table>
      ${wish.image ? `<p style="margin-top: 16px;"><img src="${wish.image}" alt="许愿图片" style="max-width: 400px; border-radius: 8px;" /></p>` : ''}
      <p style="margin-top: 20px; color: #999; font-size: 12px;">此邮件由校园墙许愿单系统自动发送</p>
    </div>
  `;

  for (const email of emails) {
    await sendEmail(email, subject, html);
  }
}
