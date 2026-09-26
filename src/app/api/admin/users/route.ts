// GET  /api/admin/users          用户列表 (ADMIN+)
// POST /api/admin/users          管理员创建用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireRole, requirePermission } from '@/lib/server-auth';
import { listUsers } from '@/lib/admin-service';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const CreateSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  nickname: z.string().min(1).max(20).optional(),
  password: z.string().min(6).max(100).optional(),
  realName: z.string().max(32).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'USER', 'SUPER_ADMIN']).optional(),
  roleId: z.string().min(1).optional(), // 自定义角色 ID (优先于 role)
  status: z.enum(['NORMAL', 'GRADUATED', 'BANNED']).optional(),
  remark: z.string().max(200).optional().or(z.literal('')),
  avatar: z.string().optional().or(z.literal('')),
  verified: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'user.view');
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    const role = (sp.get('role') as UserRole) || undefined;
    const q = sp.get('q') || undefined;
    return NextResponse.json(await listUsers(page, pageSize, role, q));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, 'user.create');
    const dto = CreateSchema.parse(await req.json());

    // 昵称: 提供则用, 否则自动生成
    const nickname = dto.nickname?.trim() || `用户${Math.random().toString(36).slice(2, 8)}`;

    // 密码: 提供则加密, 否则使用默认密码
    const rawPassword = dto.password || '123456';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 邮箱: 提供且不重复才用
    let email: string | null = null;
    if (dto.email) {
      const existing = await prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        return NextResponse.json({ message: `邮箱 ${dto.email} 已被使用` }, { status: 409 });
      }
      email = dto.email;
    }

    // 角色处理: 自定义角色优先
    let finalRole: UserRole = UserRole.STUDENT;
    let roleId: string | null = null;

    if (dto.roleId) {
      // 使用自定义角色
      const customRole = await prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!customRole) {
        return NextResponse.json({ message: '自定义角色不存在' }, { status: 400 });
      }
      roleId = customRole.id;
      // 自定义角色的系统角色标记设为 USER (基础权限由自定义角色决定)
      finalRole = UserRole.USER;
    } else {
      const role = dto.role || UserRole.STUDENT;
      if (role === UserRole.SUPER_ADMIN && me.role !== UserRole.SUPER_ADMIN) {
        return NextResponse.json({ message: '无权创建超级管理员' }, { status: 403 });
      }
      finalRole = role as UserRole;
    }

    // 管理员认证状态: ADMIN/SUPER_ADMIN 默认已认证
    const isAutoVerified = finalRole === UserRole.ADMIN || finalRole === UserRole.SUPER_ADMIN;

    const user = await prisma.user.create({
      data: {
        email,
        nickname,
        password: hashedPassword,
        realName: dto.realName || null,
        grade: dto.grade || null,
        className: dto.className || null,
        role: finalRole,
        roleId,
        status: (dto.status as any) || 'NORMAL',
        remark: dto.remark || null,
        avatar: dto.avatar || null,
        verified: dto.verified ?? isAutoVerified,
        verifiedAt: (dto.verified ?? isAutoVerified) ? new Date() : null,
      },
      select: { id: true, email: true, nickname: true, role: true, roleId: true, createdAt: true },
    });

    return NextResponse.json({
      message: `用户 ${nickname} 创建成功, 初始密码: ${rawPassword}`,
      user,
    }, { status: 201 });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    if (e?.code === 'P2002') {
      return NextResponse.json({ message: '邮箱或昵称已存在' }, { status: 409 });
    }
    return errorResponse(e);
  }
}
