// POST /api/admin/users/import  导入 Excel 批量创建用户 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const COL_NICKNAME = '昵称*';
const COL_EMAIL = '邮箱';
const COL_PASSWORD = '密码';
const COL_REALNAME = '真实姓名';
const COL_GRADE = '年级';
const COL_CLASSNAME = '班级';
const COL_ROLE = '身份';
const COL_STATUS = '状态';
const COL_REMARK = '备注';

const ROLE_MAP: Record<string, string> = { 学生: 'STUDENT', 教师: 'TEACHER', 管理员: 'ADMIN', 用户: 'USER', 超级管理员: 'SUPER_ADMIN' };
const STATUS_MAP: Record<string, string> = { 正常: 'NORMAL', 毕业生: 'GRADUATED', 封禁: 'BANNED' };

export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, 'user.import');
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ message: '请上传 Excel 文件' }, { status: 400 });

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return NextResponse.json({ message: '文件为空, 请填写数据后上传' }, { status: 400 });

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNo = i + 2;

      const nickname = String(row[COL_NICKNAME] || '').trim();
      if (!nickname) { errors.push(`第${lineNo}行: 昵称为空, 跳过`); failed++; continue; }

      const email = String(row[COL_EMAIL] || '').trim() || null;
      const rawPassword = String(row[COL_PASSWORD] || '').trim() || '123456';
      const realName = String(row[COL_REALNAME] || '').trim() || null;
      const grade = String(row[COL_GRADE] || '').trim() || null;
      const className = String(row[COL_CLASSNAME] || '').trim() || null;
      const roleStr = String(row[COL_ROLE] || '学生').trim();
      const role = (ROLE_MAP[roleStr] || 'STUDENT') as UserRole;
      const statusStr = String(row[COL_STATUS] || '正常').trim();
      const status = (STATUS_MAP[statusStr] || 'NORMAL') as any;
      const remark = String(row[COL_REMARK] || '').trim() || null;

      if (role === UserRole.SUPER_ADMIN && me.role !== UserRole.SUPER_ADMIN) {
        errors.push(`第${lineNo}行: 无权创建超级管理员`);
        failed++; continue;
      }

      try {
        if (email) {
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) { errors.push(`第${lineNo}行: 邮箱 ${email} 已存在`); failed++; continue; }
        }

        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const isAutoVerified = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;

        await prisma.user.create({
          data: {
            email, nickname, password: hashedPassword,
            realName, grade, className, role, status, remark,
            verified: isAutoVerified,
            verifiedAt: isAutoVerified ? new Date() : null,
          },
        });
        created++;
      } catch (e: any) {
        failed++;
        if (e?.code === 'P2002') errors.push(`第${lineNo}行: 邮箱或昵称重复`);
        else errors.push(`第${lineNo}行: ${e.message || '创建失败'}`);
      }
    }

    return NextResponse.json({
      message: `导入完成: 成功 ${created} 条, 失败 ${failed} 条`,
      created, failed, errors: errors.slice(0, 50),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
