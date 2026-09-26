// POST /api/admin/site-config/test-connection  测试 SMTP 连接 (不发送邮件)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import nodemailer from 'nodemailer';
import { requireRole } from '@/lib/server-auth';
import { getSmtpConfig } from '@/lib/email-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);

    const cfg = await getSmtpConfig();
    if (!cfg) {
      return NextResponse.json({ message: 'SMTP 未配置或未启用' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    try {
      await transporter.verify();
      return NextResponse.json({ ok: true, message: 'SMTP 连接成功' });
    } catch (err: any) {
      return NextResponse.json({ message: `连接失败: ${err.message || err}` }, { status: 500 });
    } finally {
      transporter.close();
    }
  } catch (e) {
    return errorResponse(e);
  }
}
