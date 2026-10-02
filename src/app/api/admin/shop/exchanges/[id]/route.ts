// PATCH /api/admin/shop/exchanges/[id]  更新兑换状态 (FULFILLED/CANCELLED) 含发放方式
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';

const FULFILLMENT_TYPES = ['SELF_PICKUP', 'EXPRESS', 'VIRTUAL_CODE', 'ONLINE', 'CONTACT', 'OTHER'] as const;

const UpdateSchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']),
  fulfillmentType: z.enum(FULFILLMENT_TYPES).optional(),
  fulfillmentInfo: z.string().max(1000).optional(),
});

const TYPE_LABELS: Record<string, string> = {
  SELF_PICKUP: '线下自提',
  EXPRESS: '快递邮寄',
  VIRTUAL_CODE: '虚拟兑换码',
  ONLINE: '线上发放',
  CONTACT: '联系管理员',
  OTHER: '其他',
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'shop.manage');
    const dto = UpdateSchema.parse(await req.json());

    const record = await prisma.exchangeRecord.findUnique({
      where: { id: params.id },
      include: { item: { select: { name: true } } },
    });
    if (!record) throw new Error('兑换记录不存在');

    const data: any = { status: dto.status };

    if (dto.status === 'FULFILLED') {
      if (!dto.fulfillmentType) throw new Error('请选择发放方式');
      data.fulfillmentType = dto.fulfillmentType;
      data.fulfillmentInfo = dto.fulfillmentInfo || null;
      data.fulfilledAt = new Date();
    }

    // 如果取消, 退还积分
    if (dto.status === 'CANCELLED' && record.status !== 'CANCELLED') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { points: { increment: record.pointsCost } } }),
        prisma.exchangeRecord.update({ where: { id: params.id }, data }),
      ]);
    } else {
      await prisma.exchangeRecord.update({ where: { id: params.id }, data });
    }

    // 发放成功后通知用户
    if (dto.status === 'FULFILLED' && record.status !== 'FULFILLED') {
      const typeLabel = TYPE_LABELS[dto.fulfillmentType || 'OTHER'] || '其他';
      let infoText = '';
      if (dto.fulfillmentInfo) {
        try {
          const parsed = JSON.parse(dto.fulfillmentInfo);
          infoText = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join('，');
        } catch { infoText = dto.fulfillmentInfo; }
      }
      const content = `您兑换的「${record.item?.name || '商品'}」已发放。发放方式: ${typeLabel}${infoText ? '。' + infoText : ''}。请到「我的-我的兑换」查看详情。`;
      await createNotification({
        userId: record.userId,
        title: '积分兑换已发放',
        content,
        link: '/profile?tab=exchanges',
        type: 'SYSTEM' as any,
      });
    }

    // 取消时通知用户
    if (dto.status === 'CANCELLED' && record.status !== 'CANCELLED') {
      await createNotification({
        userId: record.userId,
        title: '积分兑换已取消',
        content: `您兑换的「${record.item?.name || '商品'}」已取消, 积分已退还 ${record.pointsCost} 分。`,
        link: '/profile?tab=exchanges',
        type: 'SYSTEM' as any,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
