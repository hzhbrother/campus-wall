// POST /api/payment/notify/:provider  支付异步通知 webhook (公网可达, 公开)
import { NextRequest, NextResponse } from 'next/server';
import { handleNotify } from '@/lib/payment-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await handleNotify(params.provider, body));
  } catch (e) {
    return errorResponse(e);
  }
}
