// POST /api/auth/login  账号名/邮箱 + 密码登录
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken, sanitize } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  account: z.string().min(1, '请输入账号名、手机号或邮箱'),
  password: z.string().min(6, '密码至少6位'),
});

export async function POST(req: NextRequest) {
  try {
    const dto = Schema.parse(await req.json());
    // 支持邮箱 / 手机号 / 昵称 三种登录方式
    const isEmail = dto.account.includes('@');
    const isPhone = /^\d+$/.test(dto.account);
    const where = isEmail
      ? { email: dto.account }
      : isPhone
        ? { phoneNumber: dto.account }
        : { nickname: dto.account };
    const user = await prisma.user.findFirst({ where });
    if (!user || !user.password) {
      return NextResponse.json({ message: '账号或密码错误' }, { status: 401 });
    }
    // 永久封禁 (status=BANNED) 不允许登录
    if (user.status === UserStatus.BANNED) {
      return NextResponse.json({ message: '您的账号被永久封禁, 请联系管理员', banned: true, permanent: true }, { status: 403 });
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) return NextResponse.json({ message: '账号或密码错误' }, { status: 401 });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user: sanitize(user), token });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
