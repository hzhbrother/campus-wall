// PATCH /api/admin/users/:id  管理员编辑用户资料 (ADMIN+)
// DELETE /api/admin/users/:id 删除用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { updateUser, deleteUser } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  realName: z.string().max(32).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  remark: z.string().max(200).optional().or(z.literal('')),
  avatar: z.string().optional(),
  status: z.enum(['NORMAL', 'GRADUATED', 'BANNED']).optional(),
  role: z.enum(['USER', 'STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const dto = Schema.parse(await req.json());
    const data: any = {};
    if (dto.realName !== undefined) data.realName = dto.realName || null;
    if (dto.grade !== undefined) data.grade = dto.grade || null;
    if (dto.className !== undefined) data.className = dto.className || null;
    if (dto.remark !== undefined) data.remark = dto.remark || null;
    if (dto.avatar !== undefined) data.avatar = dto.avatar || null;
    if (dto.status) data.status = dto.status as UserStatus;
    if (dto.role) data.role = dto.role as UserRole;
    return NextResponse.json(await updateUser(params.id, data, me.id));
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    return NextResponse.json(await deleteUser(params.id, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
