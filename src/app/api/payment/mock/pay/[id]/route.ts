// POST /api/payment/mock/pay/:id  模拟完成支付 (Mock 渠道, 公开)
import { NextRequest, NextResponse } from 'next/server';
import { mockPay } from '@/lib/payment-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await mockPay(params.id));
  } catch (e) {
    return errorResponse(e);
  }
}
