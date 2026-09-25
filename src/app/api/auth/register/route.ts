// POST /api/auth/register  账号名注册
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AccountProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken, sanitize } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  nickname: z.string().min(2, '账号名至少2位').max(32),
  realName: z.string().max(32).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  password: z.string().min(6, '密码至少6位').max(64),
  remark: z.string().max(200).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dto = Schema.parse(body);

    // 账号名唯一
    const exists = await prisma.user.findFirst({ where: { nickname: dto.nickname } });
    if (exists) return NextResponse.json({ message: '该账号名已被使用' }, { status: 409 });

    const password = await bcrypt.hash(dto.password, 10);
    const user = await prisma.user.create({
      data: {
        nickname: dto.nickname,
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

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user: sanitize(user), token });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
