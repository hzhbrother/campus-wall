// GET  /api/payment/orders         我的订单列表
// POST /api/payment/orders         创建订单 + 拿到支付信息
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderType } from '@prisma/client';
import { requireUser } from '@/lib/server-auth';
import { createOrder, listMyOrders } from '@/lib/payment-service';
import { errorResponse } from '@/lib/api-response';

const CreateSchema = z.object({
  type: z.enum(['PIN', 'REWARD', 'VIP']),
  postId: z.string().optional(),
  amount: z.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    return NextResponse.json(await listMyOrders(me.id, page, pageSize));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = CreateSchema.parse(await req.json());
    const result = await createOrder(me.id, { type: dto.type as OrderType, postId: dto.postId, amount: dto.amount }, req);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
