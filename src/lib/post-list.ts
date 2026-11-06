// 帖子列表查询优化: 不取 base64 图片内容, 只用 Postgres cardinality 取数组长度
// 之前列表查询会把每条帖子的完整 base64 图片 (每张最大 3MB × 3) 从数据库拉回再丢弃, 严重拖慢首屏
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Post 的全部标量字段 (除 images) + 列表需要的关联, 保证返回结构与之前一致
export const postListSelect = {
  id: true,
  authorId: true,
  title: true,
  content: true,
  category: true,
  isAnonymous: true,
  status: true,
  pinned: true,
  viewCount: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, nickname: true, avatar: true, role: true, verified: true } },
  _count: { select: { favorites: true } },
} satisfies Prisma.PostSelect;

// 用 cardinality() 在数据库内算数组长度, 只回传 id + 数量, 不传输图片内容
export async function fetchImageCounts(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; n: number }[]>`
    SELECT id, cardinality(images)::int AS n FROM "Post" WHERE id IN (${Prisma.join(ids)})`;
  return new Map(rows.map(r => [r.id, r.n]));
}
