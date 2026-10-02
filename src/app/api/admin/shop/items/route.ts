// GET /api/admin/shop/items  商品列表
// POST /api/admin/shop/items 创建商品
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional().or(z.literal('')),
  image: z.string().optional().or(z.literal('')),
  pointsCost: z.number().int().min(1),
  stock: z.number().int().default(-1),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'shop.manage');
    const items = await prisma.shopItem.findMany({ orderBy: [{ pointsCost: 'asc' }] });
    return NextResponse.json({ items });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'shop.manage');
    const dto = CreateSchema.parse(await req.json());
    const item = await prisma.shopItem.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        image: dto.image || null,
        pointsCost: dto.pointsCost,
        stock: dto.stock,
        isActive: dto.isActive,
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (e) { return errorResponse(e); }
}
