// GET /api/admin/quick-links  列表 (含禁用)
// POST /api/admin/quick-links 创建
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const CreateSchema = z.object({
  title: z.string().min(1).max(50),
  url: z.string().min(1).max(500),
  icon: z.string().optional().or(z.literal('')),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  allowedPlatforms: z.string().optional().or(z.literal('')),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'quicklink.manage');
    const items = await prisma.quickLink.findMany({ orderBy: [{ clickCount: 'desc' }, { sortOrder: 'asc' }] });
    return NextResponse.json({ items });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'quicklink.manage');
    const dto = CreateSchema.parse(await req.json());
    const item = await prisma.quickLink.create({
      data: {
        title: dto.title,
        url: dto.url,
        icon: dto.icon || null,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        allowedPlatforms: dto.allowedPlatforms || null,
      },
    });
    return NextResponse.json({ success: true, item });
  } catch (e) { return errorResponse(e); }
}
