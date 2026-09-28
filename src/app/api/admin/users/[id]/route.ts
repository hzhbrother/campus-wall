// PATCH /api/admin/users/:id  管理员编辑用户资料 (ADMIN+)
// DELETE /api/admin/users/:id 删除用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { UserRole, UserStatus, VerificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, requirePermission } from '@/lib/server-auth';
import { updateUser, deleteUser } from '@/lib/admin-service';
import { errorResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';

const Schema = z.object({
  realName: z.string().max(32).optional().or(z.literal('')),
  studentId: z.string().max(32).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  remark: z.string().max(200).optional().or(z.literal('')),
  avatar: z.string().optional(),
  coverImage: z.string().optional(),
  avatarStatus: z.enum(['APPROVED', 'REJECTED']).optional(),
  avatarRejectReason: z.string().max(200).optional().or(z.literal('')),
  nickname: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
  countryCode: z.string().max(10).optional().or(z.literal('')),
  status: z.enum(['NORMAL', 'GRADUATED', 'BANNED']).optional(),
  role: z.enum(['USER', 'STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  verified: z.boolean().optional(),
  // 认证审核: APPROVED 通过 / REJECTED 驳回 / PENDING 撤回 (回到审核中)
  verificationStatus: z.enum(['APPROVED', 'REJECTED', 'NONE', 'PENDING']).optional(),
  verificationRejectReason: z.string().max(200).optional().or(z.literal('')),
  // 资质认证 (学生会/广播站等)
  qualificationType: z.string().max(50).optional().or(z.literal('')),
  qualificationVerified: z.boolean().optional(),
  qualificationStatus: z.enum(['APPROVED', 'REJECTED', 'NONE', 'PENDING']).optional(),
  qualificationRejectReason: z.string().max(200).optional().or(z.literal('')),
  // 管理员重置密码 (留空不修改)
  password: z.string().min(6).max(64).optional().or(z.literal('')),
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
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage || null;
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber || null;
    if (dto.countryCode !== undefined) data.countryCode = dto.countryCode || null;
    if (dto.qualificationType !== undefined) data.qualificationType = dto.qualificationType || null;
    if (dto.qualificationVerified !== undefined) {
      data.qualificationVerified = dto.qualificationVerified;
      data.qualificationVerifiedAt = dto.qualificationVerified ? new Date() : null;
    }
    // 资质认证审核流转
    if (dto.qualificationStatus === 'APPROVED') {
      data.qualificationVerified = true;
      data.qualificationVerifiedAt = new Date();
      data.qualificationStatus = VerificationStatus.APPROVED;
      data.qualificationRejectReason = null;
    } else if (dto.qualificationStatus === 'REJECTED') {
      data.qualificationVerified = false;
      data.qualificationVerifiedAt = null;
      data.qualificationStatus = VerificationStatus.REJECTED;
      data.qualificationRejectReason = dto.qualificationRejectReason || null;
    } else if (dto.qualificationStatus === 'PENDING') {
      // 撤回: 已通过的资质认证回到审核中
      data.qualificationVerified = false;
      data.qualificationVerifiedAt = null;
      data.qualificationStatus = VerificationStatus.PENDING;
      data.qualificationRejectReason = null;
    } else if (dto.qualificationStatus === 'NONE') {
      data.qualificationVerified = false;
      data.qualificationVerifiedAt = null;
      data.qualificationStatus = VerificationStatus.NONE;
      data.qualificationRejectReason = null;
      data.qualificationPhoto = null;
    }
    if (dto.status) data.status = dto.status as UserStatus;
    if (dto.role) data.role = dto.role as UserRole;
    // 密码重置: bcrypt hash 后写入 (留空则不修改)
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
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
  } else if (dto.verificationStatus === 'PENDING') {
    // 撤回: 已通过的身份认证回到审核中
    data.verified = false;
    data.verifiedAt = null;
    data.verificationStatus = VerificationStatus.PENDING;
    data.verificationRejectReason = null;
  } else if (dto.verificationStatus === 'NONE') {
    data.verified = false;
    data.verifiedAt = null;
    data.verificationStatus = VerificationStatus.NONE;
    data.verificationRejectReason = null;
    data.verificationPhoto = null;
  }

    // 头像审核流转: APPROVED 通过 / REJECTED 驳回
    if (dto.avatarStatus === 'APPROVED') {
      const target = await prisma.user.findUnique({ where: { id: params.id }, select: { pendingAvatar: true } });
      data.avatar = target?.pendingAvatar || null;
      data.pendingAvatar = null;
      data.avatarStatus = VerificationStatus.APPROVED;
      data.avatarReviewedAt = new Date();
      data.avatarRejectReason = null;
    } else if (dto.avatarStatus === 'REJECTED') {
      data.pendingAvatar = null;
      data.avatarStatus = VerificationStatus.REJECTED;
      data.avatarReviewedAt = new Date();
      data.avatarRejectReason = dto.avatarRejectReason || null;
    }

    const updated = await updateUser(params.id, data, me.id);

    // 密码被重置时通知用户 (不在通知里写明文密码, 由用户向管理员询问)
    if (dto.password) {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '🔑 密码已被管理员重置',
        content: '您的账号密码已被管理员重置, 请使用新密码登录。如非本人操作请联系管理员。',
      });
    }

    // 认证通过/驳回后给用户发通知
    if (dto.verificationStatus === 'APPROVED') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '✅ 身份认证已通过',
        content: '恭喜您, 您的身份认证已通过审核!',
      });
    } else if (dto.verificationStatus === 'REJECTED') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '❌ 身份认证被驳回',
        content: `您的身份认证未通过, 原因: ${dto.verificationRejectReason || '请重新提交'}`,
      });
    } else if (dto.verificationStatus === 'PENDING') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '↩️ 身份认证已撤回',
        content: '您的身份认证已被管理员撤回, 重新进入审核队列。',
      });
    }
    if (dto.qualificationStatus === 'APPROVED') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '✅ 资质认证已通过',
        content: `恭喜您, 您的「${dto.qualificationType || updated.qualificationType || '资质'}」认证已通过!`,
      });
    } else if (dto.qualificationStatus === 'REJECTED') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '❌ 资质认证被驳回',
        content: `您的资质认证未通过, 原因: ${dto.qualificationRejectReason || '请重新提交'}`,
      });
    } else if (dto.qualificationStatus === 'PENDING') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '↩️ 资质认证已撤回',
        content: '您的资质认证已被管理员撤回, 重新进入审核队列。',
      });
    }

    // 头像审核结果通知用户
    if (dto.avatarStatus === 'APPROVED') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '✅ 头像审核通过',
        content: '您的新头像已通过审核, 现已更新为正式头像。',
      });
    } else if (dto.avatarStatus === 'REJECTED') {
      await createNotification({
        userId: params.id,
        type: NotificationType.SYSTEM,
        title: '❌ 头像审核未通过',
        content: `您的头像未通过审核, 原因: ${dto.avatarRejectReason || '请重新提交'}`,
      });
    }

    return NextResponse.json(updated);
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
