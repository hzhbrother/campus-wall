// 邮件模板服务: 内置模板 + 变量替换 + 管理员自定义覆盖
// 借鉴 VoiceHub 的模板体系: 基础布局 + 内容块 + {{#if}} 条件 + HTML 转义
import { prisma } from './prisma';

export interface EmailTemplateData {
  key: string;
  name: string;
  subject: string;
  html: string;
  /** 该模板支持的变量列表 (用于 Admin 面板提示) */
  variables?: { name: string; desc: string }[];
}

// HTML 转义映射 (防止 XSS)
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

/**
 * 模板渲染: 支持 {{var}} 变量替换 与 {{#if var}}...{{/if}} 条件块
 * - 普通变量默认进行 HTML 转义
 * - 用变量名以 ! 开头可强制不转义 (如 {{!content}}), 仅用于可信 HTML 内容
 */
export function renderTemplate(template: string, vars: Record<string, any>): string {
  let result = template;

  // 1. 递归处理 {{#if key}}...{{/if}} (从最内层开始)
  let changed = true;
  while (changed) {
    changed = false;
    result = result.replace(
      /\{\{#if\s+([a-zA-Z0-9_]+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g,
      (_, key, inner) => {
        changed = true;
        const v = vars[key];
        return v ? inner : '';
      }
    );
  }

  // 2. 变量替换 {{var}} (转义) 或 {{!var}} (不转义)
  result = result.replace(/\{\{\s*(!?)([a-zA-Z0-9_]+)\s*\}\}/g, (_, raw, key) => {
    const v = vars[key];
    if (v == null) return '';
    return raw ? String(v) : escapeHtml(v);
  });

  return result;
}

// ============================================================
// 基础邮件布局 (所有内置模板共用, 统一品牌风格)
// 变量: siteName, headerSubtitle, title, contentBlock, actionUrl, actionText
// ============================================================
const BASE_LAYOUT = `
<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f7fa; padding: 20px;">
  <div style="background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
    <!-- 头部 -->
    <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 28px 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 1px;">{{siteName}}</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0 0; font-size: 13px;">{{headerSubtitle}}</p>
    </div>
    <!-- 主体 -->
    <div style="padding: 32px;">
      {{#if title}}<h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px;">{{title}}</h2>{{/if}}
      <div style="color: #4b5563; line-height: 1.8; font-size: 14px;">
        {{!contentBlock}}
      </div>
      {{#if actionUrl}}
      <div style="text-align: center; margin: 28px 0;">
        <a href="{{actionUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">{{actionText}}</a>
      </div>
      {{/if}}
    </div>
    <!-- 页脚 -->
    <div style="background: #f9fafb; padding: 20px 32px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6;">
        此邮件由 {{siteName}} 系统自动发送，请勿直接回复。<br>
        如有疑问，请联系管理员。
      </p>
    </div>
  </div>
</div>`;

// 构造完整模板: 将内容块嵌入基础布局
// 注意: 这里只做 contentBlock 的简单替换, 保留 {{#if}}/{{var}} 供最终渲染时处理
function wrapLayout(contentBlock: string, headerSubtitle: string, opts: { title?: string; actionText?: string } = {}): string {
  return BASE_LAYOUT
    .replace('{{!contentBlock}}', contentBlock)
    .replace('{{headerSubtitle}}', headerSubtitle)
    .replace('{{actionText}}', opts.actionText || '查看详情');
}

// ============================================================
// 内置模板 (按校园墙业务场景设计)
// ============================================================
export const BUILTIN_TEMPLATES: Record<string, EmailTemplateData> = {
  // 1. 邮箱验证码 (注册/改密/换绑)
  'verification-code': {
    key: 'verification-code',
    name: '邮箱验证码',
    subject: '【{{siteName}}】{{purpose}}验证码',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'purpose', desc: '用途, 如"注册账号"/"重置密码"' },
      { name: 'code', desc: '验证码' },
      { name: 'expiresInMinutes', desc: '有效期(分钟)' },
      { name: 'email', desc: '用户邮箱' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p>您正在<strong>{{purpose}}</strong>，请使用以下验证码完成操作：</p>
       <div style="text-align: center; margin: 24px 0;">
         <span style="display: inline-block; background: #eff6ff; color: #2563eb; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px;">{{code}}</span>
       </div>
       <p style="color: #9ca3af; font-size: 12px;">验证码有效期为 {{expiresInMinutes}} 分钟，请尽快使用。如非本人操作，请忽略此邮件。</p>`,
      '邮箱验证'
    ),
  },

  // 2. 通用通知 (系统通知/公告)
  'notification.generic': {
    key: 'notification.generic',
    name: '通用通知',
    subject: '【{{siteName}}】{{title}}',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'title', desc: '通知标题' },
      { name: 'message', desc: '通知内容' },
      { name: 'actionUrl', desc: '详情链接(可选)' },
      { name: 'actionText', desc: '按钮文字(可选, 默认"查看详情")' },
    ],
    html: wrapLayout(
      `<p>{{message}}</p>`,
      '通知推送',
      { actionText: '{{actionText}}' }
    ),
  },

  // 3. 帖子审核通过
  'post.approved': {
    key: 'post.approved',
    name: '帖子审核通过',
    subject: '【{{siteName}}】您的帖子已通过审核',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'postTitle', desc: '帖子标题' },
      { name: 'postUrl', desc: '帖子链接' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p>您发布的帖子《<strong>{{postTitle}}</strong>》已通过审核，现已公开发布。</p>`,
      '审核结果',
      { actionText: '查看帖子' }
    ),
  },

  // 4. 帖子审核驳回
  'post.rejected': {
    key: 'post.rejected',
    name: '帖子审核驳回',
    subject: '【{{siteName}}】您的帖子未通过审核',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'postTitle', desc: '帖子标题' },
      { name: 'reason', desc: '驳回原因' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p>很抱歉，您发布的帖子《<strong>{{postTitle}}</strong>》未通过审核。</p>
       {{#if reason}}<p>驳回原因：<strong>{{reason}}</strong></p>{{/if}}
       <p>请根据原因修改后重新发布，感谢您的理解与配合。</p>`,
      '审核结果'
    ),
  },

  // 5. 收到评论/回复
  'comment.reply': {
    key: 'comment.reply',
    name: '收到评论/回复',
    subject: '【{{siteName}}】您的帖子收到了新评论',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'postTitle', desc: '帖子标题' },
      { name: 'commenter', desc: '评论者昵称' },
      { name: 'commentContent', desc: '评论内容' },
      { name: 'postUrl', desc: '帖子链接' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p>您发布的帖子《<strong>{{postTitle}}</strong>》收到了 <strong>{{commenter}}</strong> 的新评论：</p>
       <div style="background: #f3f4f6; border-left: 3px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; color: #374151;">{{commentContent}}</div>`,
      '评论通知',
      { actionText: '查看评论' }
    ),
  },

  // 6. 收到点赞
  'post.liked': {
    key: 'post.liked',
    name: '收到点赞',
    subject: '【{{siteName}}】您的帖子被点赞了',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'postTitle', desc: '帖子标题' },
      { name: 'liker', desc: '点赞者昵称' },
      { name: 'likeCount', desc: '当前点赞数' },
      { name: 'postUrl', desc: '帖子链接' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p><strong>{{liker}}</strong> 赞了您的帖子《<strong>{{postTitle}}</strong>》。</p>
       {{#if likeCount}}<p>该帖子目前共有 <strong>{{likeCount}}</strong> 个赞。</p>{{/if}}`,
      '点赞通知',
      { actionText: '查看帖子' }
    ),
  },

  // 7. 账号封禁通知
  'user.banned': {
    key: 'user.banned',
    name: '账号封禁通知',
    subject: '【{{siteName}}】您的账号已被封禁',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'reason', desc: '封禁原因' },
      { name: 'expiresAt', desc: '解封时间(可选, 不填则永久)' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p>很遗憾地通知您，您在 {{siteName}} 的账号已被封禁。</p>
       {{#if reason}}<p>封禁原因：<strong>{{reason}}</strong></p>{{/if}}
       {{#if expiresAt}}<p>解封时间：<strong>{{expiresAt}}</strong></p>{{/if}}
       <p>如您对此有异议，可联系管理员进行申诉。</p>`,
      '账号通知'
    ),
  },

  // 8. 注册欢迎
  'register.welcome': {
    key: 'register.welcome',
    name: '注册欢迎',
    subject: '欢迎加入 {{siteName}}！',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'nickname', desc: '用户昵称' },
    ],
    html: wrapLayout(
      `<p>亲爱的 <strong>{{nickname}}</strong>，您好！</p>
       <p>欢迎加入 <strong>{{siteName}}</strong>！感谢您的注册，期待您在这里分享校园生活、交流心得。</p>
       <p>您现在可以：</p>
       <ul style="color: #4b5563; line-height: 2;">
         <li>发布帖子，分享你的校园故事</li>
         <li>浏览热门话题，参与讨论</li>
         <li>点赞、评论，与同学互动</li>
       </ul>`,
      '注册成功'
    ),
  },

  // 9. 密码重置成功
  'password.reset': {
    key: 'password.reset',
    name: '密码重置成功',
    subject: '【{{siteName}}】您的密码已重置',
    variables: [
      { name: 'siteName', desc: '站点名称' },
      { name: 'nickname', desc: '用户昵称' },
      { name: 'resetTime', desc: '重置时间' },
    ],
    html: wrapLayout(
      `<p>您好，</p>
       <p>您的账号密码已于 <strong>{{resetTime}}</strong> 成功重置。</p>
       <p>如非本人操作，请立即联系管理员，以免账号被盗。</p>`,
      '安全通知'
    ),
  },
};

// 获取模板 (优先返回自定义覆盖, 否则返回内置)
export async function getTemplate(key: string): Promise<EmailTemplateData | null> {
  const custom = await prisma.emailTemplate.findUnique({ where: { key } });
  if (custom) {
    const builtin = BUILTIN_TEMPLATES[key];
    return { key: custom.key, name: custom.name, subject: custom.subject, html: custom.html, variables: builtin?.variables };
  }
  return BUILTIN_TEMPLATES[key] || null;
}

// 获取所有模板 (内置 + 自定义覆盖标记)
export async function getAllTemplates(): Promise<(EmailTemplateData & { isOverridden: boolean })[]> {
  const customs = await prisma.emailTemplate.findMany();
  const customMap = new Map(customs.map((c) => [c.key, c]));

  const result: (EmailTemplateData & { isOverridden: boolean })[] = [];

  // 内置模板
  for (const [key, builtin] of Object.entries(BUILTIN_TEMPLATES)) {
    const custom = customMap.get(key);
    result.push({
      key,
      name: custom?.name || builtin.name,
      subject: custom?.subject || builtin.subject,
      html: custom?.html || builtin.html,
      variables: builtin.variables,
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
