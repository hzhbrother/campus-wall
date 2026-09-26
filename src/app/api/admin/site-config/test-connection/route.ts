// POST /api/admin/site-config/test-connection  测试 SMTP 连接 (不发送邮件)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { createTransporter, getSmtpConfig, SmtpConfig } from '@/lib/email-service';
import { errorResponse } from '@/lib/api-response';

/**
 * 将 SMTP 错误翻译为更易懂的诊断文字.
 * 区分: 网络不通 / TLS 握手失败 / 认证失败 / 其它
 */
function diagnose(err: any): { level: string; hint: string; code?: string; responseCode?: number } {
  const code: string | undefined = err?.code;
  const responseCode: number | undefined = err?.responseCode;
  const message: string = err?.message || String(err);

  // 1. 网络层
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' && /timeout/i.test(message)) {
    return { level: 'network', code, hint: '连接超时: 服务器无法到达, 请检查出站防火墙/安全组是否放行 SMTP 端口 (25/465/587), 或尝试更换端口' };
  }
  if (code === 'ECONNREFUSED') {
    return { level: 'network', code, hint: '连接被拒绝: 目标端口未开放 SMTP 服务, 请确认端口号正确' };
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return { level: 'network', code, hint: '网络不可达: 服务器无到 SMTP 主机的路由, 请检查网络/DNS' };
  }
  if (code === 'ENOTFOUND') {
    return { level: 'network', code, hint: 'DNS 解析失败: SMTP 主机名无法解析, 请检查 smtp.xxx.com 是否正确' };
  }

  // 2. TLS 层
  if (code === 'EPROTO' || /SSL|TLS|certificate|CERT/i.test(message)) {
    return {
      level: 'tls',
      code,
      hint: `TLS 握手失败 (${message}). 可尝试: ①改用 465+SSL/TLS 或 587+STARTTLS; ②开启"跳过证书校验"选项; ③确认服务商支持的加密方式`,
    };
  }

  // 3. 认证层 (SMTP 响应码)
  if (responseCode === 535 || responseCode === 530 || /authentication|auth.*fail/i.test(message)) {
    return {
      level: 'auth',
      code,
      responseCode,
      hint: `认证失败 (响应码 ${responseCode}): 请使用邮箱"授权码"而非登录密码; 163/QQ 邮箱需在设置中开启 SMTP 并生成授权码`,
    };
  }

  // 4. "Connection closed" - 常见于 TCP 连上但 TLS/服务端主动断开
  if (/connection closed/i.test(message)) {
    return {
      level: 'closed',
      code,
      hint: '连接被关闭: 常见原因 ①出站防火墙拦截 SMTP (云厂商常封 25 端口, 部分也封 465/587); ②TLS 加密方式不匹配 (465 需 SSL/TLS, 587 需 STARTTLS); ③服务商要求特定 TLS 版本. 建议先在服务器上执行 "telnet smtp.163.com 465" 验证端口连通性',
    };
  }

  return { level: 'unknown', code, responseCode, hint: message };
}

/** 尝试一组 SMTP 配置, 返回是否成功及诊断 */
async function tryConnect(cfg: SmtpConfig): Promise<{ ok: boolean; diag: ReturnType<typeof diagnose> }> {
  const transporter = createTransporter(cfg);
  try {
    await transporter.verify();
    return { ok: true, diag: { level: 'ok', hint: 'SMTP 连接与认证均成功' } };
  } catch (err: any) {
    return { ok: false, diag: diagnose(err) };
  } finally {
    transporter.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);

    const cfg = await getSmtpConfig();
    if (!cfg) {
      return NextResponse.json({ message: 'SMTP 未配置或未启用' }, { status: 400 });
    }

    // 先用当前保存的配置测试
    const primary = await tryConnect(cfg);
    if (primary.ok) {
      return NextResponse.json({ ok: true, message: 'SMTP 连接成功', detail: primary.diag });
    }

    // 当前配置失败 -> 自动尝试备选策略, 帮助用户找到可用组合
    const altStrategies: { label: string; cfg: SmtpConfig }[] = [
      { label: '465 + SSL/TLS (隐式)', cfg: { ...cfg, port: 465, secure: true } },
      { label: '587 + STARTTLS', cfg: { ...cfg, port: 587, secure: false } },
      { label: '25 + STARTTLS', cfg: { ...cfg, port: 25, secure: false } },
      { label: '465 + SSL/TLS + 跳过证书校验', cfg: { ...cfg, port: 465, secure: true, tlsRejectUnauthorized: false } },
    ];

    const alternatives: { label: string; ok: boolean; hint: string; level: string }[] = [];
    for (const s of altStrategies) {
      // 跳过与主配置完全相同的策略
      if (s.cfg.port === cfg.port && s.cfg.secure === cfg.secure && (s.cfg.tlsRejectUnauthorized ?? true) === (cfg.tlsRejectUnauthorized ?? true)) {
        continue;
      }
      const r = await tryConnect(s.cfg);
      alternatives.push({ label: s.label, ok: r.ok, hint: r.diag.hint, level: r.diag.level });
      if (r.ok) break; // 找到一个可用的就停
    }

    const working = alternatives.find(a => a.ok);

    return NextResponse.json(
      {
        ok: false,
        message: `连接失败: ${primary.diag.hint}`,
        detail: primary.diag,
        alternatives,
        suggestion: working
          ? `建议改用: ${working.label}`
          : '所有端口/加密组合均失败, 高度怀疑是服务器出站防火墙拦截 SMTP. 请在服务器上执行 "telnet smtp.163.com 465" 或 "nc -vz smtp.163.com 465" 确认端口连通性, 并联系云厂商放行出站 SMTP 端口.',
      },
      { status: 500 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
