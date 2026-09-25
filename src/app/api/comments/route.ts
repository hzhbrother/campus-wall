// GET  /api/comments?postId=xxx  帖子的评论列表 (公开)
// POST /api/comments             发布评论 (需登录)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { getSiteConfigBool } from '@/lib/site-config';
import { isUserBanned } from '@/lib/server-auth';

const CreateSchema = z.object({
  postId: z.string(),
  content: z.string().min(1).max(1000),
  parentId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const postId = new URL(req.url).searchParams.get('postId');
    if (!postId) return NextResponse.json({ message: '缺少 postId' }, { status: 400 });
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });
    const items = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, nickname: true, avatar: true } } },
    });
    return NextResponse.json(items);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const commentEnabled = await getSiteConfigBool('comment_enabled', true);
    if (!commentEnabled) return NextResponse.json({ message: '站点已关闭评论功能' }, { status: 403 });

    const me = await requireUser(req);
    if (isUserBanned(me)) return NextResponse.json({ message: '账号已被封禁, 暂不能评论' }, { status: 403 });
    const dto = CreateSchema.parse(await req.json());
    const post = await prisma.post.findUnique({ where: { id: dto.postId } });
    if (!post) return NextResponse.json({ message: '帖子不存在' }, { status: 404 });
    const comment = await prisma.comment.create({
      data: { postId: dto.postId, authorId: me.id, content: dto.content, parentId: dto.parentId },
      include: { author: { select: { id: true, nickname: true, avatar: true } } },
    });
    await prisma.post.update({
      where: { id: dto.postId },
      data: { commentCount: { increment: 1 } },
    });
    return NextResponse.json(comment);
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    return errorResponse(e);
  }
}
