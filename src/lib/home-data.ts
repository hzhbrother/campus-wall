// 首页服务端数据获取 (SSR, 首屏直出)
import { PostStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPostCategories, getReviewCategories, getSiteConfigValue } from '@/lib/site-config';
import { postListSelect, fetchImageCounts } from '@/lib/post-list';
import { PostListItem } from '@/components/PostCard';

export interface HomeInitialData {
  items: PostListItem[];
  hotItems: PostListItem[];
  categories: string[];
  reviewCategories: string[];
  announcement: string;
}

function mapPost(p: any, imageCount: number): PostListItem {
  return {
    id: p.id,
    title: p.title,
    content: p.content.length > 200 ? p.content.slice(0, 200) + '…' : p.content,
    category: p.category,
    images: [],
    imageCount,
    pinned: p.pinned,
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    favoriteCount: p._count?.favorites || 0,
    createdAt: p.createdAt.toISOString(),
    author: {
      id: p.author.id,
      nickname: p.author.nickname || '匿名用户',
      avatar: p.author.avatar,
      verified: p.author.verified || false,
    },
  };
}

export async function getHomeData(): Promise<HomeInitialData> {
  const DEFAULT_CATEGORIES = ['日常', '校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答', '商业推广'];

  const [rawItems, rawHot, categories, reviewCategories, announcement] = await Promise.all([
    prisma.post.findMany({
      where: { status: PostStatus.APPROVED },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: postListSelect,
    }),
    prisma.post.findMany({
      where: { status: PostStatus.APPROVED },
      orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }, { viewCount: 'desc' }],
      take: 5,
      select: postListSelect,
    }),
    getPostCategories(),
    getReviewCategories(),
    getSiteConfigValue('announcement_text', ''),
  ]);

  // 图片数量单独用 cardinality 查询, 避免拉取 base64 图片内容
  const counts = await fetchImageCounts([...rawItems, ...rawHot].map(p => p.id));

  return {
    items: rawItems.map(p => mapPost(p, counts.get(p.id) || 0)),
    hotItems: rawHot.map(p => mapPost(p, counts.get(p.id) || 0)),
    categories: categories.length ? categories : DEFAULT_CATEGORIES,
    reviewCategories: reviewCategories || [],
    announcement: announcement || '欢迎来到校园墙！请文明发言，禁止发布违规内容。',
  };
}
