// POST /api/auth/forgot-password/send-code  根据账号查找邮箱并发送验证码
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendEmailCode } from '@/lib/email-verify';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  account: z.string().min(1, '请输入账号名、手机号或邮箱'),
});

export async function POST(req: NextRequest) {
  try {
    const dto = Schema.parse(await req.json());

    // 根据账号查找用户 (支持 账号名 / 手机号 / 邮箱)
    const isEmail = dto.account.includes('@');
    const isPhone = /^\d+$/.test(dto.account);
    const where = isEmail
      ? { email: dto.account }
      : isPhone
        ? { phoneNumber: dto.account }
        : { nickname: dto.account };

    const user = await prisma.user.findFirst({ where });
    if (!user) return NextResponse.json({ message: '该账号不存在' }, { status: 404 });

    // 检查是否绑定了邮箱
    if (!user.email) {
      return NextResponse.json({ message: '该账号未绑定邮箱, 无法通过邮箱重置密码' }, { status: 400 });
    }

    // 发送验证码 (不暴露完整邮箱, 只返回脱敏后的邮箱)
    const result = await sendEmailCode(user.email, 'reset-password');
    if (!result.success) {
      return NextResponse.json({ message: result.message }, { status: 429 });
    }

    // 返回脱敏邮箱 (如 a***@example.com)
    const masked = maskEmail(user.email);
    return NextResponse.json({ message: '验证码已发送', maskedEmail: masked });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}

// 邮箱脱敏: abc@example.com → a***@example.com
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (name.length <= 1) return `${name}***@${domain}`;
  return `${name[0]}***@${domain}`;
}
