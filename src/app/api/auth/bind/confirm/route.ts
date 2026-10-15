// POST /api/auth/bind/confirm  用已有账号密码确认绑定第三方
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken, verifyToken, sanitize } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  bindToken: z.string().min(1, '绑定信息缺失'),
  account: z.string().min(1, '请输入账号'),
  password: z.string().min(6, '密码至少6位'),
});

export async function POST(req: NextRequest) {
  try {
    const { bindToken, account, password } = Schema.parse(await req.json());

    // 解析 bind_token
    const payload: any = verifyToken(bindToken);
    if (!payload || payload.sub !== 'bind') {
      return NextResponse.json({ message: '绑定信息已失效, 请重新授权' }, { status: 400 });
    }
    const provider = payload.provider;
    const socialUid = payload.social_uid;
    if (!provider || !socialUid) {
      return NextResponse.json({ message: '绑定信息无效' }, { status: 400 });
    }

    // 登录验证
    const isEmail = account.includes('@');
    const isPhone = /^\d+$/.test(account);
    const where = isEmail
      ? { email: account }
      : isPhone
        ? { phoneNumber: account }
        : { nickname: account };
    const user = await prisma.user.findFirst({ where });
    if (!user || !user.password) {
      return NextResponse.json({ message: '账号或密码错误' }, { status: 401 });
    }
    if (user.status === UserStatus.BANNED) {
      return NextResponse.json({ message: '您的账号被永久封禁' }, { status: 403 });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return NextResponse.json({ message: '账号或密码错误' }, { status: 401 });

    // 检查是否已被其他用户绑定
    const existing = await prisma.account.findUnique({
      where: { provider_providerUid: { provider, providerUid: socialUid } },
    });
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ message: '该第三方账号已被其他用户绑定' }, { status: 400 });
    }

    // 创建绑定
    await prisma.account.upsert({
      where: { provider_providerUid: { provider, providerUid: socialUid } },
      update: { userId: user.id },
      create: {
        userId: user.id,
        provider,
        providerUid: socialUid,
        rawProfile: { nickname: payload.nickname, avatar: payload.avatar } as any,
      },
    });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user: sanitize(user), token });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
