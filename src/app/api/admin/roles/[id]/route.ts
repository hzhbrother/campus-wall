// PATCH  /api/admin/roles/[id]  更新角色名称与权限  - 仅超级管理员
// DELETE /api/admin/roles/[id]  删除自定义角色        - 仅超级管理员 (系统角色不可删)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { PERMISSION_CODES } from '@/lib/permissions';

const UpdateSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  permissions: z.array(z.string()).max(100).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = UpdateSchema.parse(await req.json());

    const existing = await prisma.role.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ message: '角色不存在' }, { status: 404 });
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.permissions !== undefined) {
      // 过滤无效权限码
      data.permissions = dto.permissions.filter(p => PERMISSION_CODES.includes(p));
    }

    const role = await prisma.role.update({ where: { id: params.id }, data });
    return NextResponse.json({ message: '角色更新成功', role });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);

    const existing = await prisma.role.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ message: '角色不存在' }, { status: 404 });
    }
    if (existing.isSystem) {
      return NextResponse.json({ message: '系统内置角色不可删除' }, { status: 400 });
    }

    // 将使用该角色的用户重置为默认系统角色 (roleId 清空, 保留原 role 枚举)
    await prisma.user.updateMany({
      where: { roleId: params.id },
      data: { roleId: null },
    });

    await prisma.role.delete({ where: { id: params.id } });
    return NextResponse.json({ message: '角色已删除, 关联用户已重置为系统角色' });
  } catch (e) {
    return errorResponse(e);
  }
}
