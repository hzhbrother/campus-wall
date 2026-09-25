// 支付业务逻辑: 订单创建 / 标记已支付 / 列表 / 查询
import { OrderType, OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getProvider, PaymentContext } from '@/lib/payment';
import { requestOrigin } from '@/lib/api-response';
import type { NextRequest } from 'next/server';

// 各订单类型的默认定价 (分)
const PRICE_PRESET: Record<OrderType, number> = {
  PIN: 500,   // 置顶推广 5 元
  VIP: 990,   // 会员订阅 9.9 元/月
  REWARD: 0,  // 打赏: 由前端传入
};

function subjectOf(type: OrderType) {
  switch (type) {
    case OrderType.PIN: return '校园墙-帖子置顶推广';
    case OrderType.VIP: return '校园墙-会员订阅';
    case OrderType.REWARD: return '校园墙-打赏';
  }
}

export async function createOrder(userId: string, dto: { type: OrderType; postId?: string; amount?: number }, req: NextRequest) {
  const type = dto.type;
  let amount = PRICE_PRESET[type];
  if (type === OrderType.REWARD) {
    if (!dto.amount || dto.amount <= 0) throw new Error('打赏金额必填');
    amount = dto.amount;
  }
  if ((type === OrderType.PIN || type === OrderType.REWARD) && !dto.postId) {
    throw new Error('置顶/打赏需提供 postId');
  }
  if (dto.postId) {
    const post = await prisma.post.findUnique({ where: { id: dto.postId } });
    if (!post) throw new Error('帖子不存在');
  }

  const provider = getProvider();
  const ctx: PaymentContext = { origin: requestOrigin(req) };
  const subject = subjectOf(type);
  const order = await prisma.order.create({
    data: { userId, postId: dto.postId, type, amount, subject, provider: provider.name, status: OrderStatus.PENDING },
  });
  const payment = await provider.createPayment({ id: order.id, subject, amount }, ctx);
  return { order, payment };
}

// Mock 完成支付
export async function mockPay(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('订单不存在');
  if (order.provider !== 'mock') throw new Error('该订单非 mock 渠道, 不能模拟支付');
  if (order.status !== OrderStatus.PENDING) throw new Error('订单状态不可支付');
  return markPaid(order.id);
}

export async function handleNotify(provider: string, body: any) {
  const prov = getProvider();
  if (prov.name !== provider) return { verified: false };
  const result = prov.parseNotify(body, {});
  if (!result.verified) return { verified: false };
  if (result.outTradeNo) await markPaid(result.outTradeNo, result.raw);
  return { verified: true };
}

// 标记订单已支付并执行业务副作用
async function markPaid(orderId: string, raw?: any) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== OrderStatus.PENDING) return order;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.PAID, paidAt: new Date(), providerOrderNo: raw?.transaction_id || raw?.trade_no || null },
  });
  if (order.type === OrderType.PIN && order.postId) {
    await prisma.post.update({ where: { id: order.postId }, data: { pinned: true } });
  }
  return updated;
}

export async function listMyOrders(userId: string, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { items, total, page, pageSize };
}

export async function getOrder(id: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('订单不存在');
  if (order.userId !== userId) throw new Error('订单不存在');
  return order;
}
