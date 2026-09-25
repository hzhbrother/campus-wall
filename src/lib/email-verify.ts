// 邮箱验证码服务: 生成/发送/校验邮箱验证码 (用于忘记密码、绑定邮箱等)
import { prisma } from './prisma';
import { sendEmail } from './email-service';

const CODE_EXPIRE_MINUTES = 10;   // 验证码有效期 10 分钟
const RESEND_INTERVAL_SEC = 60;   // 同邮箱重发间隔 60 秒
const MAX_CODES_PER_HOUR = 10;    // 同邮箱每小时最多 10 条

// 生成 6 位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送邮箱验证码
export async function sendEmailCode(email: string, purpose: string): Promise<{ success: boolean; message: string }> {
  // 1. 限流: 同邮箱 60 秒内不可重复发送
  const recent = await prisma.emailVerificationCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (elapsed < RESEND_INTERVAL_SEC) {
      return { success: false, message: `请 ${Math.ceil(RESEND_INTERVAL_SEC - elapsed)} 秒后再试` };
    }
  }

  // 2. 限流: 同邮箱每小时最多 10 条
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.emailVerificationCode.count({
    where: { email, purpose, createdAt: { gte: oneHourAgo } },
  });
  if (count >= MAX_CODES_PER_HOUR) {
    return { success: false, message: '该邮箱今日发送次数已达上限' };
  }

  // 3. 生成并保存验证码
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000);
  await prisma.emailVerificationCode.create({
    data: { email, code, purpose, expiresAt },
  });

  // 4. 发送邮件
  const subject = purpose === 'reset-password' ? '【校园墙】重置密码验证码' : '【校园墙】邮箱验证码';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">校园墙</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">您好，</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          ${purpose === 'reset-password' ? '您正在重置密码，' : '您正在进行邮箱验证，'}
          请使用以下验证码完成操作：
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; background: #eff6ff; color: #2563eb; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 12px; line-height: 1.6;">
          验证码有效期为 ${CODE_EXPIRE_MINUTES} 分钟，请尽快使用。如非本人操作，请忽略此邮件。
        </p>
      </div>
    </div>
  `;

  const ok = await sendEmail(email, subject, html);
  if (!ok) {
    // 发送失败, 删除刚创建的记录
    await prisma.emailVerificationCode.deleteMany({ where: { email, purpose, code } }).catch(() => {});
    return { success: false, message: '邮件发送失败, 请稍后重试' };
  }
  return { success: true, message: '验证码已发送, 请注意查收' };
}

// 校验验证码 (校验成功后标记为已用)
export async function verifyEmailCode(email: string, code: string, purpose: string): Promise<boolean> {
  const record = await prisma.emailVerificationCode.findFirst({
    where: { email, purpose, code, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;
  await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { used: true } });
  return true;
}

// 清理过期验证码
export async function cleanupExpiredEmailCodes(): Promise<number> {
  const result = await prisma.emailVerificationCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
