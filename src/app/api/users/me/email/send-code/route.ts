// POST /api/users/me/email/send-code  发送邮箱绑定/变更验证码
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { sendEmailCode } from '@/lib/email-verify';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  email: z.string().email('邮箱格式不正确'),
});

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = Schema.parse(await req.json());

    // 检查邮箱是否已被其他用户使用
    const existing = await prisma.user.findFirst({
      where: { email: dto.email, id: { not: me.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ message: '该邮箱已被其他账号使用' }, { status: 409 });
    }

    // 发送验证码 (绑定/变更邮箱)
    const purpose = me.email ? 'change-email' : 'bind-email';
    const result = await sendEmailCode(dto.email, purpose);
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
