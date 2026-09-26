// GET /api/admin/badges  勋章列表 (ADMIN+)
// POST /api/admin/badges  创建勋章 (SUPER_ADMIN)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, requirePermission } from '@/lib/server-auth';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional().or(z.literal('')),
  icon: z.string().optional(),
  conditionType: z.enum(['POST_COUNT', 'LIKE_COUNT', 'COMMENT_COUNT', 'CHECKIN_DAYS', 'POINTS', 'MANUAL']),
  threshold: z.number().int().min(1).default(1),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'user.edit');
    const badges = await prisma.badge.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ items: badges });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = CreateSchema.parse(await req.json());
    const badge = await prisma.badge.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        icon: dto.icon || null,
        conditionType: dto.conditionType,
        threshold: dto.threshold,
        isActive: dto.isActive ?? true,
      },
    });
    return NextResponse.json(badge);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
