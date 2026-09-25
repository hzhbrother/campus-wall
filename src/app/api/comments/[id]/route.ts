// PATCH /api/comments/:id  编辑评论 (作者或管理员)
// DELETE /api/comments/:id  删除评论 (作者或管理员)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    const body = await req.json();
    const content = String(body.content || '').trim();
    if (!content) return NextResponse.json({ message: '评论内容不能为空' }, { status: 400 });
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) return NextResponse.json({ message: '评论不存在' }, { status: 404 });
    if (comment.authorId !== me.id && me.role === UserRole.USER) {
      return NextResponse.json({ message: '只能编辑自己的评论' }, { status: 403 });
    }
    const updated = await prisma.comment.update({ where: { id: params.id }, data: { content } });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) return NextResponse.json({ message: '评论不存在' }, { status: 404 });
    if (comment.authorId !== me.id && me.role === UserRole.USER) {
      return NextResponse.json({ message: '只能删除自己的评论' }, { status: 403 });
    }
    await prisma.$transaction([
      prisma.comment.delete({ where: { id: params.id } }),
      prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
