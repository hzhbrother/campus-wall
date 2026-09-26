// 邮件服务: 从 SiteConfig 读取 SMTP 配置并发送邮件
import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from './prisma';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;       // 发件人显示 (Name <email> 或纯邮箱)
  secure: boolean;
  // 可选: 宽松 TLS (跳过证书校验), 用于自签/内网证书场景
  tlsRejectUnauthorized?: boolean;
}

/**
 * 构建 nodemailer transporter.
 * - 465 端口走隐式 SSL (secure=true)
 * - 587/25 端口走 STARTTLS (secure=false, 自动升级)
 * - 增加超时, 避免连接挂起
 * - 针对国内邮箱 (163/QQ/阿里云) 做 TLS 兼容
 */
export function createTransporter(cfg: SmtpConfig): Transporter {
  const isImplicitSsl = cfg.port === 465 || cfg.secure;

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: isImplicitSsl,
    auth: { user: cfg.user, pass: cfg.pass },
    // 超时设置 (毫秒)
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    // 针对国内服务商的 TLS 兼容: 允许较老的 TLS 版本与更多 cipher
    tls: {
      rejectUnauthorized: cfg.tlsRejectUnauthorized ?? true,
      minVersion: 'TLSv1.2',
      // 部分国内 SMTP 服务端 cipher 兼容性较差, 放宽候选集
      ciphers: 'DEFAULT',
    },
    // 部分服务端需要显式声明 STARTTLS
    requireTLS: cfg.port === 587,
    pool: false,
    // 调试日志 (可按需打开)
    debug: false,
    logger: false,
  });
}

// 从数据库读取 SMTP 配置
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const keys = ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name', 'smtp_from_email', 'smtp_secure', 'smtp_tls_reject_unauthorized'];
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
    tlsRejectUnauthorized: map.get('smtp_tls_reject_unauthorized') === 'false' ? false : undefined,
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
    const transporter = createTransporter(cfg);
    await transporter.sendMail({ from: cfg.from, to, subject, html });
    transporter.close();
    return true;
  } catch (e: any) {
    // 打印结构化错误, 方便定位是网络/TLS/认证哪一层失败
    console.error('[email] 发送失败', {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      code: e?.code,
      command: e?.command,
      response: e?.response,
      responseCode: e?.responseCode,
      message: e?.message,
    });
    return false;
  }
}
