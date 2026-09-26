// GET  /api/admin/verification-templates        模板列表 (超级管理员)
// POST /api/admin/verification-templates        创建模板
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
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

const CreateSchema = z.object({
  name: z.string().min(1).max(30),
  image: z.string().min(1),
  fields: z.array(FieldSchema).max(20),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const templates = await prisma.verificationTemplate.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ templates });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = CreateSchema.parse(await req.json());
    // 新建模板默认非激活
    const tpl = await prisma.verificationTemplate.create({
      data: { name: dto.name, image: dto.image, fields: dto.fields as any },
    });
    return NextResponse.json({ message: '模板创建成功', template: tpl }, { status: 201 });
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
