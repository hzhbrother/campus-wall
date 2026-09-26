// POST /api/auth/register/send-code  注册时发送邮箱验证码 (公开接口)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendEmailCode } from '@/lib/email-verify';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  email: z.string().email('邮箱格式不正确'),
});

export async function POST(req: NextRequest) {
  try {
    const dto = Schema.parse(await req.json());

    // 检查邮箱是否已被注册
    const existing = await prisma.user.findFirst({ where: { email: dto.email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ message: '该邮箱已被注册' }, { status: 409 });
    }

    // 发送注册验证码
    const result = await sendEmailCode(dto.email, 'register');
    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: 429 });
    }

    return NextResponse.json({ message: '验证码已发送' });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
