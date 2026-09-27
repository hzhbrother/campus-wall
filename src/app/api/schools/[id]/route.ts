// PATCH  /api/schools/[id]  更新学校 (ADMIN+)
// DELETE /api/schools/[id]  删除学校 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const STAGES = ['幼儿园', '小学', '初中', '高中', '大学', '其他'];

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  stage: z.enum(STAGES as [string, ...string[]]).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'school.manage');
    const dto = UpdateSchema.parse(await req.json());
    const school = await prisma.school.update({
      where: { id: params.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.stage !== undefined ? { stage: dto.stage || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      },
    });
    return NextResponse.json(school);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, 'school.manage');
    await prisma.school.delete({ where: { id: params.id } });
    return NextResponse.json({ message: '已删除' });
  } catch (e) {
    return errorResponse(e);
  }
}
