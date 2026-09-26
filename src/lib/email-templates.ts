// 邮件模板服务: 内置模板 + 变量替换 + 管理员自定义覆盖
import { prisma } from './prisma';

export interface EmailTemplateData {
  key: string;
  name: string;
  subject: string;
  html: string;
}

// 内置模板
export const BUILTIN_TEMPLATES: Record<string, EmailTemplateData> = {
  'verification-code': {
    key: 'verification-code',
    name: '邮箱验证码',
    subject: '【校园墙】{{purpose}}验证码',
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">校园墙</h1>
  </div>
  <div style="background: #f9fafb; padding: 32px; border-radius: 0 0 12px 12px;">
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">您好，</p>
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">
      您正在{{purpose}}，请使用以下验证码完成操作：
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; background: #eff6ff; color: #2563eb; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px;">{{code}}</span>
    </div>
    <p style="color: #6b7280; font-size: 12px; line-height: 1.6;">
      验证码有效期为 {{expiresInMinutes}} 分钟，请尽快使用。如非本人操作，请忽略此邮件。
    </p>
  </div>
</div>`,
  },
};

// 变量替换 (支持 {{varName}} 语法)
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

// 获取模板 (优先返回自定义覆盖, 否则返回内置)
export async function getTemplate(key: string): Promise<EmailTemplateData | null> {
  const custom = await prisma.emailTemplate.findUnique({ where: { key } });
  if (custom) return { key: custom.key, name: custom.name, subject: custom.subject, html: custom.html };
  return BUILTIN_TEMPLATES[key] || null;
}

// 获取所有模板 (内置 + 自定义覆盖标记)
export async function getAllTemplates(): Promise<(EmailTemplateData & { isOverridden: boolean })[]> {
  const customs = await prisma.emailTemplate.findMany();
  const customMap = new Map(customs.map(c => [c.key, c]));

  const result: (EmailTemplateData & { isOverridden: boolean })[] = [];

  // 内置模板
  for (const [key, builtin] of Object.entries(BUILTIN_TEMPLATES)) {
    const custom = customMap.get(key);
    result.push({
      key,
      name: custom?.name || builtin.name,
      subject: custom?.subject || builtin.subject,
      html: custom?.html || builtin.html,
      isOverridden: !!custom,
    });
    customMap.delete(key);
  }

  // 额外自定义模板
  for (const c of customMap.values()) {
    result.push({ key: c.key, name: c.name, subject: c.subject, html: c.html, isOverridden: true });
  }

  return result;
}

// 保存模板 (upsert)
export async function saveTemplate(key: string, name: string, subject: string, html: string) {
  await prisma.emailTemplate.upsert({
    where: { key },
    update: { name, subject, html },
    create: { key, name, subject, html },
  });
}

// 删除自定义模板 (恢复内置)
export async function deleteTemplate(key: string) {
  await prisma.emailTemplate.delete({ where: { key } }).catch(() => {});
}
