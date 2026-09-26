// 邮箱验证码服务: 生成/发送/校验邮箱验证码 (用于忘记密码、绑定邮箱等)
import { prisma } from './prisma';
import { sendEmail } from './email-service';
import { getTemplate, renderTemplate } from './email-templates';

const CODE_EXPIRE_MINUTES = 10;   // 验证码有效期 10 分钟
const RESEND_INTERVAL_SEC = 60;   // 同邮箱重发间隔 60 秒
const MAX_CODES_PER_HOUR = 10;    // 同邮箱每小时最多 10 条

// 用途中文映射
const PURPOSE_LABEL: Record<string, string> = {
  'reset-password': '重置密码',
  'bind-email': '绑定邮箱',
  'change-email': '变更邮箱',
};

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

  // 4. 获取邮件模板并渲染
  const template = await getTemplate('verification-code');
  const purposeLabel = PURPOSE_LABEL[purpose] || '邮箱验证';
  // 获取站点名称
  const siteRow = await prisma.siteConfig.findUnique({ where: { key: 'site_name' } }).catch(() => null);
  const siteName = siteRow?.value || '校园墙';
  const vars = {
    siteName,
    purpose: purposeLabel,
    code,
    expiresInMinutes: String(CODE_EXPIRE_MINUTES),
    email,
  };
  const subject = template ? renderTemplate(template.subject, vars) : `【校园墙】${purposeLabel}验证码`;
  const html = template
    ? renderTemplate(template.html, vars)
    : `<p>您的${purposeLabel}验证码是：<b>${code}</b>，${CODE_EXPIRE_MINUTES}分钟内有效。</p>`;

  // 5. 发送邮件
  const ok = await sendEmail(email, subject, html);
  if (!ok) {
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
