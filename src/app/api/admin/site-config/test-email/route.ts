// POST /api/admin/site-config/test-email  发送测试邮件
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { sendEmail } from '@/lib/email-service';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    // 测试邮件发送仅超级管理员可用
    await requireRole(req, UserRole.SUPER_ADMIN);
    const { to } = await req.json();
    if (!to) return NextResponse.json({ message: '请输入收件邮箱' }, { status: 400 });

    const html = `
      <div style="max-width:600px;margin:0 auto;font-family:sans-serif;padding:20px;">
        <h2 style="color:#3b82f6;">📧 邮件测试</h2>
        <p style="color:#374151;line-height:1.6;">恭喜！您的 SMTP 邮件配置已成功生效。</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:30px;">此邮件由校园墙系统自动发送，请勿直接回复。</p>
      </div>`;

    const ok = await sendEmail(to, '【校园墙】邮件配置测试', html);
    if (!ok) return NextResponse.json({ message: '发送失败，请检查 SMTP 配置' }, { status: 500 });
    return NextResponse.json({ ok: true, message: '测试邮件已发送，请查收' });
  } catch (e) {
    return errorResponse(e);
  }
}
