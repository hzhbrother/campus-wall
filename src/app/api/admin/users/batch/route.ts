// POST /api/admin/users/batch  批量更新用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

// 每条记录: userId 必填, 其余字段可选 (只更新提供的字段)
const BatchItemSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['USER', 'STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['NORMAL', 'GRADUATED', 'BANNED']).optional(),
  grade: z.string().max(20).optional().or(z.literal('')),
  className: z.string().max(20).optional().or(z.literal('')),
  remark: z.string().max(200).optional().or(z.literal('')),
  verified: z.boolean().optional(),
});

const BatchSchema = z.object({
  items: z.array(BatchItemSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, 'user.batch');
    const { items } = BatchSchema.parse(await req.json());

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const data: any = {};
        if (item.role) {
          // 管理员不能设别人为超级管理员
          if (item.role === 'SUPER_ADMIN' && me.role !== UserRole.SUPER_ADMIN) {
            errors.push(`${item.userId}: 无权设为超级管理员`);
            failed++; continue;
          }
          data.role = item.role as UserRole;
        }
        if (item.status) data.status = item.status as UserStatus;
        if (item.grade !== undefined) data.grade = item.grade || null;
        if (item.className !== undefined) data.className = item.className || null;
        if (item.remark !== undefined) data.remark = item.remark || null;
        if (item.verified !== undefined) {
          data.verified = item.verified;
          data.verifiedAt = item.verified ? new Date() : null;
        }

        await prisma.user.update({ where: { id: item.userId }, data });
        updated++;
      } catch (e: any) {
        failed++;
        errors.push(`${item.userId}: ${e.message || '更新失败'}`);
      }
    }

    return NextResponse.json({
      message: `批量更新完成: 成功 ${updated} 条, 失败 ${failed} 条`,
      updated, failed, errors: errors.slice(0, 20),
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
