// GET  /api/qualifications/:id/comments  评论列表 (分页, 含楼中楼前 5 条回复)
// POST /api/qualifications/:id/comments  发表评论 (需登录, 受可见性限制)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest, requireUser, isUserBanned } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { NotificationType } from '@prisma/client';
import { createNotification } from '@/lib/notification-service';
import { isQualificationVisible } from '../visibility';

// 评论作者简要信息
const USER_SELECT = {
  id: true,
  nickname: true,
  avatar: true,
  role: true,
  verified: true,
} as const;

// GET 评论列表 (顶层评论分页, 每条带前 5 条回复 + replies 总数)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 50)));

    const q = await prisma.qualification.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, visibility: true, status: true },
    });
    if (!q) return NextResponse.json({ message: '资质/奖状不存在' }, { status: 404 });

    // 先校验可见性 (同详情接口逻辑)
    const viewer = await getUserFromRequest(req);
    const decision = await isQualificationVisible(q, viewer?.id ?? null);
    if (!decision.visible) {
      return NextResponse.json({ message: decision.message }, { status: decision.status });
    }

    // 仅查顶层评论 (parentId 为 null), 楼中楼作为 replies 子查询返回
    const where = { qualificationId: params.id, parentId: null };
    const [items, total] = await Promise.all([
      prisma.qualificationComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: { select: USER_SELECT },
          replies: {
            orderBy: { createdAt: 'asc' },
            take: 5,
            include: { author: { select: USER_SELECT } },
          },
          _count: { select: { replies: true } },
        },
      }),
      prisma.qualificationComment.count({ where }),
    ]);

    // 管理员/超级管理员默认已认证
    const isAdmin = (r: string) => r === 'ADMIN' || r === 'SUPER_ADMIN';
    const mapAuthor = (a: any) => ({ ...a, verified: a.verified || isAdmin(a.role) });
    const enriched = items.map(c => ({
      ...c,
      author: mapAuthor(c.author),
      replies: c.replies.map(r => ({ ...r, author: mapAuthor(r.author) })),
    }));

    return NextResponse.json({ items: enriched, total, page, pageSize });
  } catch (e) {
    return errorResponse(e);
  }
}

const CreateSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(500, '评论最多 500 字'),
  parentId: z.string().optional(),
});

// POST 发表评论 (需登录; PRIVATE/FOLLOWERS 限制评论权限同查看权限)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser(req);
    if (isUserBanned(me)) {
      return NextResponse.json({ message: '账号已被封禁, 暂不能评论' }, { status: 403 });
    }
    const dto = CreateSchema.parse(await req.json());

    const q = await prisma.qualification.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, visibility: true, status: true, type: true },
    });
    if (!q) return NextResponse.json({ message: '资质/奖状不存在' }, { status: 404 });

    // 先校验可见性: 看不到则不能评论
    const decision = await isQualificationVisible(q, me.id);
    if (!decision.visible) {
      return NextResponse.json({ message: decision.message }, { status: decision.status });
    }

    // 校验 parentId 合法性 (必须存在且属于同一 qualification)
    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      const parent = await prisma.qualificationComment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, qualificationId: true, authorId: true },
      });
      if (!parent || parent.qualificationId !== params.id) {
        return NextResponse.json({ message: '被回复的评论不存在' }, { status: 400 });
      }
      parentAuthorId = parent.authorId;
    }

    const comment = await prisma.qualificationComment.create({
      data: {
        qualificationId: params.id,
        authorId: me.id,
        content: dto.content,
        parentId: dto.parentId ?? null,
      },
      include: { author: { select: USER_SELECT } },
    });

    // 给 qualification.owner 发系统通知 (跳过自己评论自己)
    const link = `/users/${q.userId}/qualifications/${params.id}`;
    if (q.userId !== me.id) {
      await createNotification({
        userId: q.userId,
        type: NotificationType.SYSTEM,
        title: '💬 你的奖状收到新评论',
        content: `「${me.nickname || '匿名用户'}」在你的「${q.type}」下发表了评论`,
        link,
      });
    }

    // 如果是回复 (parentId), 还给被回复评论的 author 发通知 (跳过自己和 owner 去重)
    if (parentAuthorId && parentAuthorId !== me.id && parentAuthorId !== q.userId) {
      await createNotification({
        userId: parentAuthorId,
        type: NotificationType.SYSTEM,
        title: '💬 你的评论收到新回复',
        content: `「${me.nickname || '匿名用户'}」回复了你的评论`,
        link,
      });
    }

    return NextResponse.json(comment);
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ message: e.errors?.[0]?.message || '参数错误' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
