// PATCH  /api/orgs/[id]  更新团体 (ADMIN+)
// DELETE /api/orgs/[id]  删除团体 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'org.manage');
    const dto = UpdateSchema.parse(await req.json());
    const org = await prisma.organization.update({
      where: { id: params.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      },
    });
    return NextResponse.json(org);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'org.manage');
    await prisma.organization.delete({ where: { id: params.id } });
    return NextResponse.json({ message: '已删除' });
  } catch (e) {
    return errorResponse(e);
  }
}
