// POST /api/auth/login  邮箱密码登录
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, sanitize } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const dto = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.password) {
      return NextResponse.json({ message: '邮箱或密码错误' }, { status: 401 });
    }
    if (user.banned) {
      return NextResponse.json({ message: '账号已被封禁, 请联系管理员' }, { status: 401 });
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) return NextResponse.json({ message: '邮箱或密码错误' }, { status: 401 });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({ user: sanitize(user), token });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
