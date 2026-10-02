// PATCH /api/admin/quick-links/[id]  更新
// DELETE /api/admin/quick-links/[id] 删除
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  title: z.string().min(1).max(50).optional(),
  url: z.string().min(1).max(500).optional(),
  icon: z.string().optional().or(z.literal('')),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'quicklink.manage');
    const dto = UpdateSchema.parse(await req.json());
    const data: any = { ...dto };
    if (dto.icon === '') data.icon = null;
    const item = await prisma.quickLink.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, item });
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'quicklink.manage');
    await prisma.quickLink.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
