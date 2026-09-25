// POST /api/auth/register  邮箱密码注册
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AccountProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken, sanitize } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(64),
  nickname: z.string().min(1).max(32),
  studentId: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dto = Schema.parse(body);

    const exists = await prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) return NextResponse.json({ message: '该邮箱已注册' }, { status: 409 });

    const password = await bcrypt.hash(dto.password, 10);
    const user = await prisma.user.create({
      data: { email: dto.email, password, nickname: dto.nickname, studentId: dto.studentId },
    });
    await prisma.account.create({
      data: { userId: user.id, provider: AccountProvider.LOCAL, providerUid: user.email! },
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
