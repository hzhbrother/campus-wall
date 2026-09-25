// POST /api/users/me/change-password  修改密码
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6).max(64),
});

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user || !user.password) {
      return NextResponse.json({ message: '当前账号未设置密码' }, { status: 400 });
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) return NextResponse.json({ message: '原密码错误' }, { status: 400 });
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await prisma.user.update({ where: { id: me.id }, data: { password: hashed } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
