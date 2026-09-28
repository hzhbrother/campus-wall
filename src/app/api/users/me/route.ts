// GET   /api/users/me   当前用户完整资料
// PATCH /api/users/me   更新自己的资料
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole, VerificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser, sanitize } from '@/lib/server-auth';
import { verifyEmailCode } from '@/lib/email-verify';
import { errorResponse } from '@/lib/api-response';
import { moderateAvatar } from '@/lib/avatar-moderation';
import { createNotification } from '@/lib/notification-service';

const UpdateSchema = z.object({
  nickname: z.string().max(32).optional(),
  avatar: z.string().optional(),
  coverImage: z.string().optional().or(z.literal('')),
  studentId: z.string().max(20).optional(),
  realName: z.string().max(32).optional().or(z.literal('')),
  email: z.string().email('邮箱格式不正确').max(120).optional().or(z.literal('')),
  countryCode: z.string().max(8).optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  remark: z.string().max(200).optional().or(z.literal('')),
  schoolId: z.string().max(100).optional().or(z.literal('')),
  organizationId: z.string().max(100).optional().or(z.literal('')),
  // 隐私开关 (默认公开)
  followsPublic: z.boolean().optional(),
  fansPublic: z.boolean().optional(),
  badgesPublic: z.boolean().optional(),
  honorsPublic: z.boolean().optional(),
  favoritesPublic: z.boolean().optional(),
  likesPublic: z.boolean().optional(),
  // 邮箱变更时需携带的验证码
  emailCode: z.string().length(6, '验证码为6位数字').optional(),
});

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const [user, likesReceived] = await Promise.all([
      prisma.user.findUnique({
        where: { id: me.id },
        include: {
          // _count 同时返回 favorites, 避免前端统计栏"收藏"恒为 0
          _count: { select: { posts: true, comments: true, likes: true, favorites: true } },
          customRole: { select: { id: true, name: true, permissions: true } },
          school: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      // "获赞" = 别人给我所有帖子点的赞总数 (Like 表通过 post 关联到 authorId=me.id)
      prisma.like.count({ where: { post: { authorId: me.id } } }),
    ]);
    // 把 likesReceived 挂到 _count 上, 方便前端统一读取
    const sanitized = sanitize(user) as any;
    if (sanitized) {
      sanitized._count = { ...(sanitized._count || {}), likesReceived };
    }
    return NextResponse.json(sanitized);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const dto = UpdateSchema.parse(await req.json());

    // 如果邮箱发生变更, 必须验证验证码
    if (dto.email !== undefined && dto.email !== me.email) {
      if (!dto.emailCode) {
        return NextResponse.json({ message: '变更邮箱需要验证码' }, { status: 400 });
      }
      const purpose = me.email ? 'change-email' : 'bind-email';
      const valid = await verifyEmailCode(dto.email, dto.emailCode, purpose);
      if (!valid) {
        return NextResponse.json({ message: '验证码错误或已过期' }, { status: 400 });
      }
    }

    // 移除 emailCode (不存入数据库)
    const { emailCode, ...rest } = dto;
    const data: any = { ...rest };

    // 头像不直接更新正式 avatar 字段, 走 AI 初筛 + 人工审核流程
    const newAvatar = dto.avatar;
    if (newAvatar !== undefined) {
      delete data.avatar; // 不直接更新 avatar
      const moderation = await moderateAvatar(newAvatar);
      if (!moderation.passed) {
        return NextResponse.json({ message: moderation.reason || '头像未通过安全检测' }, { status: 400 });
      }
      data.pendingAvatar = newAvatar;
      data.avatarStatus = VerificationStatus.PENDING;
      data.avatarRejectReason = null;
      // 通知管理员审核
      const admins = await prisma.user.findMany({
        where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
        select: { id: true },
      });
      await Promise.all(admins.map(a => createNotification({
        userId: a.id,
        type: NotificationType.SYSTEM,
        title: '🟡 新头像待审核',
        content: `用户 ${me.nickname} 提交了新头像，请及时审核`,
      })));
    }

    // 隐私开关 (默认公开)
    if (dto.followsPublic !== undefined) data.followsPublic = dto.followsPublic;
    if (dto.fansPublic !== undefined) data.fansPublic = dto.fansPublic;
    if (dto.badgesPublic !== undefined) data.badgesPublic = dto.badgesPublic;
    if (dto.honorsPublic !== undefined) data.honorsPublic = dto.honorsPublic;
    if (dto.favoritesPublic !== undefined) data.favoritesPublic = dto.favoritesPublic;
    if (dto.likesPublic !== undefined) data.likesPublic = dto.likesPublic;

    // 学校与团体互斥: 设置一个时清空另一个
    // 注意: 必须用 else if, 否则第一个 if 设置 organizationId=null 后,
    // 第二个 if 的条件 (organizationId !== undefined) 会为 true, 导致 schoolId 被覆盖为 null
    if (dto.schoolId) {
      // 设置学校 → 清空团体
      data.organizationId = null;
      data.schoolId = dto.schoolId;
    } else if (dto.organizationId) {
      // 设置团体 → 清空学校
      data.schoolId = null;
      data.organizationId = dto.organizationId;
    } else if (dto.schoolId !== undefined || dto.organizationId !== undefined) {
      // 显式清空: 传了字段但都是空值
      data.schoolId = null;
      data.organizationId = null;
    }

    const user = await prisma.user.update({ where: { id: me.id }, data });
    return NextResponse.json(sanitize(user));
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    // 邮箱唯一约束冲突
    if (e?.code === 'P2002' && e?.meta?.target?.includes('email')) {
      return NextResponse.json({ message: '该邮箱已被使用' }, { status: 409 });
    }
    return errorResponse(e);
  }
}
