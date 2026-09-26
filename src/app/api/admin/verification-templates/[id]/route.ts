// PATCH  /api/admin/verification-templates/[id]  更新模板
// DELETE /api/admin/verification-templates/[id]  删除模板
// POST   /api/admin/verification-templates/[id]/activate  设为激活模板
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole, VerificationTemplateType } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const FieldSchema = z.object({
  name: z.string().min(1).max(20),
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
});

const UpdateSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  type: z.nativeEnum(VerificationTemplateType).optional(),
  image: z.string().min(1).optional(),
  fields: z.array(FieldSchema).max(20).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = UpdateSchema.parse(await req.json());
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.fields !== undefined) data.fields = dto.fields;
    const tpl = await prisma.verificationTemplate.update({ where: { id: params.id }, data });
    return NextResponse.json({ message: '更新成功', template: tpl });
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    await prisma.verificationTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ message: '删除成功' });
  } catch (e) {
    return errorResponse(e);
  }
}
