// POST /api/auth/forgot-password/reset  验证邮箱验证码并重置密码
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyEmailCode } from '@/lib/email-verify';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  account: z.string().min(1, '请输入账号'),
  code: z.string().length(6, '验证码为6位'),
  newPassword: z.string().min(6, '密码至少6位').max(64),
});

export async function POST(req: NextRequest) {
  try {
    const dto = Schema.parse(await req.json());

    // 查找用户
    const isEmail = dto.account.includes('@');
    const isPhone = /^\d+$/.test(dto.account);
    const where = isEmail
      ? { email: dto.account }
      : isPhone
        ? { phoneNumber: dto.account }
        : { nickname: dto.account };

    const user = await prisma.user.findFirst({ where });
    if (!user) return NextResponse.json({ message: '该账号不存在' }, { status: 404 });
    if (!user.email) return NextResponse.json({ message: '该账号未绑定邮箱' }, { status: 400 });

    // 校验验证码
    const ok = await verifyEmailCode(user.email, dto.code, 'reset-password');
    if (!ok) return NextResponse.json({ message: '验证码错误或已过期' }, { status: 400 });

    // 更新密码
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return NextResponse.json({ message: '密码重置成功, 请使用新密码登录' });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
