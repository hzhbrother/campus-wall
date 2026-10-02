// PATCH /api/admin/wishes/[id]  更新许愿状态 (PENDING/REVIEWED/ADOPTED)
// DELETE /api/admin/wishes/[id] 删除许愿
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'ADOPTED']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'wish.review');
    const { status } = UpdateSchema.parse(await req.json());
    await prisma.wishItem.update({ where: { id: params.id }, data: { status } });
    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'wish.review');
    await prisma.wishItem.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
