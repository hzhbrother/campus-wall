// GET/PATCH /api/admin/site-config  站点配置 (SMTP/站点信息等)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/api-response';

const CONFIG_KEYS = [
  // 站点信息
  'site_name', 'site_desc', 'site_logo', 'site_url', 'site_icp', 'contact_email', 'site_keywords',
  // SMTP
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure',
  // 功能开关
  'allow_register', 'post_requires_approval', 'allow_anonymous', 'email_notify_enabled', 'comment_enabled',
  // 内容设置
  'post_categories', 'daily_post_limit', 'sensitive_words',
  // 协议内容
  'agreement_content', 'privacy_content',
];

export async function GET() {
  const rows = await prisma.siteConfig.findMany({ where: { key: { in: CONFIG_KEYS } } });
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return NextResponse.json(map);
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);
    const body = await req.json();
    const entries = Object.entries(body).filter(([k]) => CONFIG_KEYS.includes(k));
    await Promise.all(
      entries.map(([k, v]) =>
        prisma.siteConfig.upsert({
          where: { key: k },
          update: { value: String(v) },
          create: { key: k, value: String(v) },
        })
      )
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
