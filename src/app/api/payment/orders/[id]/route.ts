// GET /api/payment/orders/:id  订单详情
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getOrder } from '@/lib/payment-service';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    return NextResponse.json(await getOrder(params.id, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
