// GET    /api/posts/:id   帖子详情 (匿名可访问, 未通过仅作者/管理员可见)
// PATCH  /api/posts/:id   编辑 (作者或管理员)
// DELETE /api/posts/:id   删除 (作者或管理员)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PostStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest, requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const CATEGORIES = ['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答'];
const UpdateSchema = z.object({
  title: z.string().max(100).optional(),
  content: z.string().max(5000).optional(),
  category: z.enum(CATEGORIES as [string, ...string[]]).optional(),
  images: z.array(z.string()).optional(),
  isAnonymous: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, nickname: true, avatar: true, role: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, nickname: true, avatar: true } } },
        },
      },
    });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });
    if (post.status !== PostStatus.APPROVED) {
      const viewer = await getUserFromRequest(req);
      if (!viewer || (viewer.id !== post.authorId && viewer.role === UserRole.USER)) {
        return NextResponse.json({ message: '帖子不存在' }, { status: 404 });
      }
    }
    // 异步累加浏览量 (不阻塞返回)
    prisma.post.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    // 检查当前用户是否已收藏
    const viewer = await getUserFromRequest(req);
    let favorited = false;
    if (viewer) {
      favorited = (await prisma.favorite.count({ where: { userId: viewer.id, postId: params.id } })) > 0;
    }
    return NextResponse.json({ ...post, favorited });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });
    if (post.authorId !== me.id && me.role === UserRole.USER) {
      return NextResponse.json({ message: '只能编辑自己的帖子' }, { status: 403 });
    }
    const dto = UpdateSchema.parse(await req.json());
    const updated = await prisma.post.update({ where: { id: params.id }, data: dto });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });
    if (post.authorId !== me.id && me.role === UserRole.USER) {
      return NextResponse.json({ message: '只能删除自己的帖子' }, { status: 403 });
    }
    await prisma.post.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
