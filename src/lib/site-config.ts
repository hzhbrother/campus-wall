// 站点配置辅助: 快速读取 SiteConfig
import { prisma } from './prisma';

export async function getSiteConfigMap(): Promise<Record<string, string>> {
  const rows = await prisma.siteConfig.findMany();
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

export async function getSiteConfigValue(key: string, defaultValue = ''): Promise<string> {
  const row = await prisma.siteConfig.findUnique({ where: { key } });
  return row?.value ?? defaultValue;
}

export async function getSiteConfigBool(key: string, defaultValue = false): Promise<boolean> {
  const v = await getSiteConfigValue(key);
  if (v === '') return defaultValue;
  return v === 'true';
}

export async function getPostCategories(): Promise<string[]> {
  const v = await getSiteConfigValue('post_categories');
  if (!v) return ['日常', '校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答', '商业推广'];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

// 需要审核的分类 (商业/招募类), 管理员可在站点配置 review_categories 中自定义
export async function getReviewCategories(): Promise<string[]> {
  const v = await getSiteConfigValue('review_categories');
  if (!v) return ['招聘兼职', '商业推广'];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}
