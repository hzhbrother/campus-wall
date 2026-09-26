// PATCH /api/admin/badges/[id]  更新勋章
// DELETE /api/admin/badges/[id] 删除勋章
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/server-auth';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().or(z.literal('')),
  icon: z.string().optional(),
  conditionType: z.enum(['POST_COUNT', 'LIKE_COUNT', 'COMMENT_COUNT', 'CHECKIN_DAYS', 'POINTS', 'MANUAL']).optional(),
  threshold: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = UpdateSchema.parse(await req.json());
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.icon !== undefined) data.icon = dto.icon || null;
    if (dto.conditionType !== undefined) data.conditionType = dto.conditionType;
    if (dto.threshold !== undefined) data.threshold = dto.threshold;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const badge = await prisma.badge.update({ where: { id: params.id }, data });
    return NextResponse.json(badge);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    await prisma.badge.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
