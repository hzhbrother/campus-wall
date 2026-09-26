// PATCH /api/admin/users/:id  管理员编辑用户资料 (ADMIN+)
// DELETE /api/admin/users/:id 删除用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole, UserStatus, VerificationStatus } from '@prisma/client';
import { requireRole, requirePermission } from '@/lib/server-auth';
import { updateUser, deleteUser } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';

const Schema = z.object({
  realName: z.string().max(32).optional().or(z.literal('')),
  studentId: z.string().max(32).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  remark: z.string().max(200).optional().or(z.literal('')),
  avatar: z.string().optional(),
  nickname: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
  countryCode: z.string().max(10).optional().or(z.literal('')),
  status: z.enum(['NORMAL', 'GRADUATED', 'BANNED']).optional(),
  role: z.enum(['USER', 'STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  verified: z.boolean().optional(),
  // 认证审核: APPROVED 通过 / REJECTED 驳回 (驳回时需传 rejectReason)
  verificationStatus: z.enum(['APPROVED', 'REJECTED', 'NONE']).optional(),
  verificationRejectReason: z.string().max(200).optional().or(z.literal('')),
  // 资质认证 (学生会/广播站等)
  qualificationType: z.string().max(50).optional().or(z.literal('')),
  qualificationVerified: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requirePermission(req, 'user.edit');
    const dto = Schema.parse(await req.json());
    const data: any = {};
    if (dto.realName !== undefined) data.realName = dto.realName || null;
    if (dto.studentId !== undefined) data.studentId = dto.studentId || null;
    if (dto.grade !== undefined) data.grade = dto.grade || null;
    if (dto.className !== undefined) data.className = dto.className || null;
    if (dto.remark !== undefined) data.remark = dto.remark || null;
    if (dto.avatar !== undefined) data.avatar = dto.avatar || null;
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber || null;
    if (dto.countryCode !== undefined) data.countryCode = dto.countryCode || null;
    if (dto.qualificationType !== undefined) data.qualificationType = dto.qualificationType || null;
    if (dto.qualificationVerified !== undefined) {
      data.qualificationVerified = dto.qualificationVerified;
      data.qualificationVerifiedAt = dto.qualificationVerified ? new Date() : null;
    }
    if (dto.status) data.status = dto.status as UserStatus;
    if (dto.role) data.role = dto.role as UserRole;
    if (dto.verified !== undefined) {
      data.verified = dto.verified;
      data.verifiedAt = dto.verified ? new Date() : null;
    }
    // 认证审核流转
  if (dto.verificationStatus === 'APPROVED') {
    data.verified = true;
    data.verifiedAt = new Date();
    data.verificationStatus = VerificationStatus.APPROVED;
    data.verificationRejectReason = null;
  } else if (dto.verificationStatus === 'REJECTED') {
    data.verified = false;
    data.verifiedAt = null;
    data.verificationStatus = VerificationStatus.REJECTED;
    data.verificationRejectReason = dto.verificationRejectReason || null;
  } else if (dto.verificationStatus === 'NONE') {
    data.verified = false;
    data.verifiedAt = null;
    data.verificationStatus = VerificationStatus.NONE;
    data.verificationRejectReason = null;
    data.verificationPhoto = null;
  }
    return NextResponse.json(await updateUser(params.id, data, me.id));
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 仅超级管理员可删除用户
    const me = await requireRole(req, UserRole.SUPER_ADMIN);
    return NextResponse.json(await deleteUser(params.id, me.id));
  } catch (e) {
    return errorResponse(e);
  }
}
