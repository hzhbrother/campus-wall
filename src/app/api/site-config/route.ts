// GET /api/site-config  公开站点配置 (前端用于显示站点名称/分类等)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PUBLIC_KEYS = [
  'site_name', 'site_desc', 'site_logo', 'site_url', 'site_icp', 'contact_email', 'site_keywords',
  'allow_register', 'allow_anonymous', 'comment_enabled',
  'post_categories',
  'agreement_content', 'privacy_content',
  'about_content',
];

export async function GET() {
  const rows = await prisma.siteConfig.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  // 默认值
  if (!map.site_name) map.site_name = '校园墙';
  if (!map.site_desc) map.site_desc = '校园信息交流平台';
  if (!map.allow_register) map.allow_register = 'true';
  if (!map.allow_anonymous) map.allow_anonymous = 'true';
  if (!map.comment_enabled) map.comment_enabled = 'true';
  if (!map.post_categories) map.post_categories = '校园,失物招领,二手交易,表白墙,寻物启事,招聘兼职,求助问答';
  return NextResponse.json(map);
}
