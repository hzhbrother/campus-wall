// 邮件服务: 从 SiteConfig 读取 SMTP 配置并发送邮件
import nodemailer from 'nodemailer';
import { prisma } from './prisma';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;       // 发件人显示 (Name <email> 或纯邮箱)
  secure: boolean;
}

// 从数据库读取 SMTP 配置
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const keys = ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name', 'smtp_from_email', 'smtp_secure'];
  const rows = await prisma.siteConfig.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map(r => [r.key, r.value]));

  // 邮件服务总开关
  const enabled = map.get('smtp_enabled');
  if (enabled === 'false') return null;

  const host = map.get('smtp_host');
  const port = map.get('smtp_port');
  const user = map.get('smtp_user');
  const pass = map.get('smtp_pass');
  if (!host || !port || !user || !pass) return null;

  // 发件人: 优先 smtp_from_name + smtp_from_email, 其次 smtp_from, 最后 smtp_user
  const fromName = map.get('smtp_from_name');
  const fromEmail = map.get('smtp_from_email');
  const fromLegacy = map.get('smtp_from');
  let from: string;
  if (fromEmail) {
    from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  } else {
    from = fromLegacy || user;
  }

  return {
    host,
    port: parseInt(port, 10),
    user,
    pass,
    from,
    secure: map.get('smtp_secure') === 'true',
  };
}

// 保存 SMTP 配置
export async function saveSmtpConfig(cfg: Partial<SmtpConfig>) {
  const map: Record<string, string> = {};
  if (cfg.host) map.smtp_host = cfg.host;
  if (cfg.port) map.smtp_port = String(cfg.port);
  if (cfg.user) map.smtp_user = cfg.user;
  if (cfg.pass) map.smtp_pass = cfg.pass;
  if (cfg.from) map.smtp_from = cfg.from;
  if (cfg.secure !== undefined) map.smtp_secure = String(cfg.secure);

  await Promise.all(
    Object.entries(map).map(([k, v]) =>
      prisma.siteConfig.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
    )
  );
}

// 发送邮件
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // 检查邮件通知总开关
  const toggle = await prisma.siteConfig.findUnique({ where: { key: 'email_notify_enabled' } });
  if (toggle && toggle.value === 'false') {
    console.warn('[email] 邮件通知已关闭, 跳过发送');
    return false;
  }
  const cfg = await getSmtpConfig();
  if (!cfg) {
    console.warn('[email] SMTP 未配置或未启用, 跳过发送');
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({ from: cfg.from, to, subject, html });
    return true;
  } catch (e) {
    console.error('[email] 发送失败:', e);
    return false;
  }
}
