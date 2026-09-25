// GET /api/posts            公开信息流 (分类/关键词筛选, 置顶优先)
// POST /api/posts           发布帖子 (普通用户待审核, 管理员直通)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PostStatus, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { getSiteConfigBool, getSiteConfigValue, getPostCategories } from '@/lib/site-config';
import { isUserBanned } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    const category = sp.get('category') || undefined;
    const q = sp.get('q') || undefined;
    const authorId = sp.get('authorId') || undefined;
    const sort = sp.get('sort') || 'latest';
    const where: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      ...(category ? { category } : {}),
      ...(authorId ? { authorId } : {}),
      ...(q
        ? { OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ] }
        : {}),
    };
    const orderBy = sort === 'hot'
      ? [{ likeCount: 'desc' as const }, { commentCount: 'desc' as const }, { viewCount: 'desc' as const }]
      : [{ pinned: 'desc' as const }, { createdAt: 'desc' as const }];

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: { select: { id: true, nickname: true, avatar: true, role: true } } },
      }),
      prisma.post.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) return NextResponse.json({ message: '未登录' }, { status: 401 });
    if (isUserBanned(me)) return NextResponse.json({ message: '账号已被封禁, 暂不能发帖' }, { status: 403 });

    // 读取站点配置
    const [categories, allowAnonymous, requiresApproval, dailyLimit, sensitiveWords] = await Promise.all([
      getPostCategories(),
      getSiteConfigBool('allow_anonymous', true),
      getSiteConfigBool('post_requires_approval', true),
      getSiteConfigValue('daily_post_limit', '0'),
      getSiteConfigValue('sensitive_words', ''),
    ]);

    const CreateSchema = z.object({
      title: z.string().min(2).max(100),
      content: z.string().min(2).max(5000),
      category: z.enum([...categories] as [string, ...string[]]),
      images: z.array(z.string().max(3 * 1024 * 1024)).max(9).optional(),
      isAnonymous: z.boolean().optional(),
    });

    const dto = CreateSchema.parse(await req.json());

    // 匿名开关
    if (dto.isAnonymous && !allowAnonymous) {
      return NextResponse.json({ message: '站点已关闭匿名发帖功能' }, { status: 403 });
    }

    // 敏感词过滤
    if (sensitiveWords) {
      const words = sensitiveWords.split(',').map(s => s.trim()).filter(Boolean);
      const text = dto.title + dto.content;
      const hit = words.find(w => text.includes(w));
      if (hit) return NextResponse.json({ message: `内容包含敏感词: ${hit}` }, { status: 400 });
    }

    // 每日发帖限制
    const limit = parseInt(dailyLimit, 10) || 0;
    if (limit > 0 && me.role !== UserRole.ADMIN && me.role !== UserRole.SUPER_ADMIN) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const todayCount = await prisma.post.count({ where: { authorId: me.id, createdAt: { gte: start } } });
      if (todayCount >= limit) return NextResponse.json({ message: `今日发帖已达上限 (${limit}条)` }, { status: 429 });
    }

    // 审核状态: 管理员直通, 普通用户按配置决定是否审核
    const isAdmin = me.role === UserRole.ADMIN || me.role === UserRole.SUPER_ADMIN;
    const status = isAdmin || !requiresApproval ? PostStatus.APPROVED : PostStatus.PENDING;

    const post = await prisma.post.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        images: dto.images || [],
        isAnonymous: dto.isAnonymous || false,
        authorId: me.id,
        status,
      },
      include: { author: { select: { id: true, nickname: true, avatar: true } } },
    });
    return NextResponse.json(post);
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
