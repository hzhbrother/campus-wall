// POST /api/ban-appeals  提交封禁申诉
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  banRecordId: z.string(),
  reason: z.string().min(1, '请填写申诉原因').max(100),
  content: z.string().min(1, '请填写申诉内容').max(1000),
  images: z.array(z.string()).max(6).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = Schema.parse(await req.json());

    const banRecord = await prisma.banRecord.findUnique({ where: { id: dto.banRecordId } });
    if (!banRecord || banRecord.userId !== me.id) {
      return NextResponse.json({ message: '封禁记录不存在' }, { status: 404 });
    }

    // 同一条封禁记录已有待处理申诉, 不允许重复提交
    const existing = await prisma.banAppeal.findFirst({
      where: { banRecordId: dto.banRecordId, userId: me.id, status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json({ message: '该封禁已有申诉在处理中, 请耐心等待' }, { status: 400 });
    }

    const appeal = await prisma.banAppeal.create({
      data: {
        userId: me.id,
        banRecordId: dto.banRecordId,
        reason: dto.reason,
        content: dto.content,
        images: dto.images || [],
      },
    });
    return NextResponse.json(appeal);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
