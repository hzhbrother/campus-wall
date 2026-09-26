// POST /api/auth/register  账号名注册 (邮箱必填 + 验证码)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AccountProvider, UserRole, NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken, sanitize } from '@/lib/server-auth';
import { verifyEmailCode } from '@/lib/email-verify';
import { errorResponse } from '@/lib/api-response';
import { getSiteConfigBool } from '@/lib/site-config';
import { createNotification } from '@/lib/notification-service';

const Schema = z.object({
  nickname: z.string().min(2, '账号名至少2位').max(32),
  email: z.string().email('邮箱格式不正确'),
  emailCode: z.string().length(6, '验证码为6位数字'),
  realName: z.string().max(32).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  password: z.string().min(6, '密码至少6位').max(64),
  remark: z.string().max(200).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const allowRegister = await getSiteConfigBool('allow_register', true);
    if (!allowRegister) return NextResponse.json({ message: '站点已关闭注册功能' }, { status: 403 });

    const body = await req.json();
    const dto = Schema.parse(body);

    // 账号名唯一
    const exists = await prisma.user.findFirst({ where: { nickname: dto.nickname } });
    if (exists) return NextResponse.json({ message: '该账号名已被使用' }, { status: 409 });

    // 邮箱唯一
    const emailExists = await prisma.user.findFirst({ where: { email: dto.email } });
    if (emailExists) return NextResponse.json({ message: '该邮箱已被注册' }, { status: 409 });

    // 校验邮箱验证码
    const valid = await verifyEmailCode(dto.email, dto.emailCode, 'register');
    if (!valid) return NextResponse.json({ message: '验证码错误或已过期' }, { status: 400 });

    const password = await bcrypt.hash(dto.password, 10);
    const user = await prisma.user.create({
      data: {
        nickname: dto.nickname,
        email: dto.email,
        password,
        realName: dto.realName || null,
        grade: dto.grade || null,
        className: dto.className || null,
        remark: dto.remark || null,
      },
    });
    await prisma.account.create({
      data: { userId: user.id, provider: AccountProvider.LOCAL, providerUid: user.nickname },
    });

    // 通知所有管理员: 有新用户注册
    const regTime = new Date().toLocaleString('zh-CN');
    const notifContent = `新用户「${user.nickname}」于 ${regTime} 完成注册。\n邮箱: ${user.email}`;
    await createNotification({
      targetRole: UserRole.SUPER_ADMIN,
      type: NotificationType.SYSTEM,
      title: '新用户注册',
      content: notifContent,
      link: '/profile?tab=users',
    });
    await createNotification({
      targetRole: UserRole.ADMIN,
      type: NotificationType.SYSTEM,
      title: '新用户注册',
      content: notifContent,
      link: '/profile?tab=users',
    });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user: sanitize(user), token });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    // 唯一约束冲突
    if (e?.code === 'P2002') {
      const target = e?.meta?.target;
      if (target?.includes('email')) return NextResponse.json({ message: '该邮箱已被注册' }, { status: 409 });
      if (target?.includes('nickname')) return NextResponse.json({ message: '该账号名已被使用' }, { status: 409 });
    }
    return errorResponse(e);
  }
}
