// POST /api/admin/roles/batch-delete  批量删除自定义角色 (系统角色自动跳过) - 仅超级管理员
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  ids: z.array(z.string()).min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = Schema.parse(await req.json());

    // 只允许删除自定义角色 (系统角色不可删)
    const roles = await prisma.role.findMany({
      where: { id: { in: dto.ids }, isSystem: false },
      select: { id: true, name: true },
    });
    const deletableIds = roles.map(r => r.id);

    if (deletableIds.length === 0) {
      return NextResponse.json({ message: '没有可删除的自定义角色 (系统角色不可删)' }, { status: 400 });
    }

    // 将使用这些角色的用户重置 (清空 roleId, 保留原 role 枚举)
    await prisma.user.updateMany({
      where: { roleId: { in: deletableIds } },
      data: { roleId: null },
    });

    const deleted = await prisma.role.deleteMany({
      where: { id: { in: deletableIds } },
    });

    return NextResponse.json({
      message: `已删除 ${deleted.count} 个角色`,
      deleted: deleted.count,
      skipped: dto.ids.length - deletableIds.length,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
