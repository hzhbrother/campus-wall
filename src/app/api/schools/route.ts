// GET  /api/schools   学校列表 (公开, 含用户数)
// POST /api/schools   创建学校 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const STAGES = ['幼儿园', '小学', '初中', '高中', '大学', '其他'];

const CreateSchema = z.object({
  name: z.string().min(1, '学校名称不能为空').max(100),
  stage: z.enum(STAGES as [string, ...string[]]).optional().or(z.literal('')),
  gradeCount: z.number().int().min(1).max(20).optional().default(12),
  description: z.string().max(500).optional().or(z.literal('')),
});

export async function GET() {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ items: schools });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'school.manage');
    const dto = CreateSchema.parse(await req.json());
    const school = await prisma.school.create({
      data: {
        name: dto.name,
        stage: dto.stage || null,
        gradeCount: dto.gradeCount,
        description: dto.description || null,
      },
    });
    return NextResponse.json(school);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
