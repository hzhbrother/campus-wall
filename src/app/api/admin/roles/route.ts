// GET  /api/admin/roles  角色列表 (含用户数)  - 仅超级管理员
// POST /api/admin/roles  创建自定义角色         - 仅超级管理员
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';
import { seedRoles } from '@/lib/role-service';
import { PERMISSION_CODES } from '@/lib/permissions';

const CreateSchema = z.object({
  name: z.string().min(1).max(20),
  permissions: z.array(z.string()).max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    await seedRoles();

    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });

    // 统计每个角色的用户数:
    // - 系统角色: 用户通过 User.role 枚举关联 (roleId 为空)
    // - 自定义角色: 用户通过 User.roleId 外键关联
    const groups = await prisma.user.groupBy({
      by: ['role', 'roleId'],
      _count: true,
    });
    const countByRole: Record<string, number> = {};
    const countByRoleId: Record<string, number> = {};
    for (const g of groups) {
      if (g.roleId) {
        countByRoleId[g.roleId] = (countByRoleId[g.roleId] || 0) + g._count;
      } else if (g.role) {
        countByRole[g.role] = (countByRole[g.role] || 0) + g._count;
      }
    }

    return NextResponse.json({
      roles: roles.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        permissions: Array.isArray(r.permissions) ? r.permissions : [],
        isSystem: r.isSystem,
        isDefault: r.isDefault,
        userCount: r.isSystem ? (countByRole[r.code] || 0) : (countByRoleId[r.id] || 0),
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const dto = CreateSchema.parse(await req.json());

    // 过滤无效权限码
    const validPerms = (dto.permissions || []).filter(p => PERMISSION_CODES.includes(p));

    const role = await prisma.role.create({
      data: {
        code: `CUSTOM_${Date.now()}`,
        name: dto.name,
        permissions: validPerms,
        isSystem: false,
        isDefault: false,
      },
    });

    return NextResponse.json({ message: '角色创建成功', role }, { status: 201 });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
