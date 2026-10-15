// PATCH /api/admin/shop/items/[id]  更新商品
// DELETE /api/admin/shop/items/[id] 删除商品
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  image: z.string().optional().or(z.literal('')),
  pointsCost: z.number().int().min(1).optional(),
  stock: z.number().int().optional(),
  isActive: z.boolean().optional(),
  // 兑换门槛
  pointsThreshold: z.number().int().min(0).nullable().optional(),
  coinThreshold: z.number().int().min(0).nullable().optional(),
  thresholdMode: z.enum(['NONE', 'ALL', 'ANY']).optional(),
  // 兑换人群限制
  allowedGrades: z.array(z.string()).optional(),
  allowedClasses: z.array(z.string()).optional(),
  allowedRoles: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'shop.manage');
    const dto = UpdateSchema.parse(await req.json());
    const data: any = { ...dto };
    if (dto.description === '') data.description = null;
    if (dto.image === '') data.image = null;
    // 显式传 null 表示清除门槛
    if (dto.pointsThreshold === undefined) delete data.pointsThreshold;
    if (dto.coinThreshold === undefined) delete data.coinThreshold;
    const item = await prisma.shopItem.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, item });
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'shop.manage');
    await prisma.shopItem.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
