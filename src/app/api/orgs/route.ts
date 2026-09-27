// GET  /api/orgs   团体列表 (公开, 含用户数)
// POST /api/orgs   创建团体 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const CreateSchema = z.object({
  name: z.string().min(1, '团体名称不能为空').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
});

export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ items: orgs });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'org.manage');
    const dto = CreateSchema.parse(await req.json());
    const org = await prisma.organization.create({
      data: {
        name: dto.name,
        description: dto.description || null,
      },
    });
    return NextResponse.json(org);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
