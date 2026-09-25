// GET /api/posts            公开信息流 (分类/关键词筛选, 置顶优先)
// POST /api/posts           发布帖子 (普通用户待审核, 管理员直通)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PostStatus, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const CATEGORIES = ['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答'];

const CreateSchema = z.object({
  title: z.string().min(2).max(100),
  content: z.string().min(2).max(5000),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  images: z.array(z.string()).optional(),
  isAnonymous: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 10)));
    const category = sp.get('category') || undefined;
    const q = sp.get('q') || undefined;
    const where: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      ...(category ? { category } : {}),
      ...(q
        ? { OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
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
    const dto = CreateSchema.parse(await req.json());
    const status = me.role === UserRole.USER ? PostStatus.PENDING : PostStatus.APPROVED;
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
