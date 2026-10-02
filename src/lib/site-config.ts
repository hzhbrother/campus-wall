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

// 需要审核的分类: 管理员在站点配置 review_categories 中勾选的分类
// 配置为空字符串时表示不审核任何分类 (管理员完全控制)
// 配置 key 不存在 (从未设置) 时使用默认值
export async function getReviewCategories(): Promise<string[]> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'review_categories' } });
  if (!row) return ['招聘兼职', '商业推广']; // 从未设置过: 默认审核这两个
  const v = row.value.trim();
  if (!v) return []; // 管理员显式清空: 不审核任何分类
  return v.split(',').map(s => s.trim()).filter(Boolean);
}
