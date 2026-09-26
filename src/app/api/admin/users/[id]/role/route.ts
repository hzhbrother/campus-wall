// PATCH /api/admin/users/:id/role  设置用户角色 (系统角色 或 自定义角色)
// SUPER_ADMIN only (因涉及权限分配)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  // 系统角色枚举 (二选一)
  role: z.enum(['USER', 'STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  // 自定义角色 ID (二选一, 传 roleId 时忽略 role)
  roleId: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = Schema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json({ message: '用户不存在' }, { status: 404 });
    }

    let data: any = {};
    if (dto.roleId) {
      // 设置自定义角色: 校验角色存在且非系统超管
      const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) {
        return NextResponse.json({ message: '角色不存在' }, { status: 400 });
      }
      data = { roleId: role.id };
    } else if (dto.role) {
      // 设置系统角色: 清空自定义角色
      data = { role: dto.role as UserRole, roleId: null };
    } else {
      return NextResponse.json({ message: '请提供 role 或 roleId' }, { status: 400 });
    }

    const updated = await prisma.user.update({ where: { id: params.id }, data });
    return NextResponse.json({ message: '角色已更新', user: updated });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
