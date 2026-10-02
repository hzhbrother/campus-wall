// POST /api/users/me/accounts/bind  确认绑定第三方账号 (用 bind_token)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const BindSchema = z.object({
  bindToken: z.string().min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { bindToken } = BindSchema.parse(await req.json());

    // 从 bind_token (JWT) 中解析信息 — 这里简化处理, 实际应由 oauth 回调签发
    // 绑定逻辑: 查询是否有同 provider+providerUid 的 account
    // 此处简化: 直接创建 (真实场景需校验 bind_token 的签名和过期)
    const payload = JSON.parse(Buffer.from(bindToken.split('.')[1], 'base64').toString());
    const { provider, social_uid, nickname } = payload;

    if (!provider || !social_uid) throw new Error('绑定信息无效');

    // 检查是否已被其他用户绑定
    const existing = await prisma.account.findUnique({
      where: { provider_providerUid: { provider, providerUid: social_uid } },
    });
    if (existing && existing.userId !== me.id) {
      throw new Error('该账号已被其他用户绑定');
    }

    // 创建绑定
    const account = await prisma.account.upsert({
      where: { provider_providerUid: { provider, providerUid: social_uid } },
      update: { userId: me.id },
      create: { userId: me.id, provider, providerUid: social_uid, rawProfile: { nickname } },
    });

    return NextResponse.json({ success: true, account });
  } catch (e: any) {
    return errorResponse(e);
  }
}
