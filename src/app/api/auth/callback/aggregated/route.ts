// GET /api/auth/callback/aggregated  聚合登录回调
import { NextRequest, NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/server-auth';
import { getAggregatedUserInfo, getJuheTypeMeta } from '@/lib/aggregated-login';
import { requestOrigin } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const feError = (msg: string) => NextResponse.redirect(`${origin}/oauth/callback?error=${encodeURIComponent(msg)}`);

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const type = url.searchParams.get('type') || req.cookies.get('juhe_type')?.value;
  const cookieState = req.cookies.get('oauth_state')?.value;

  if (!type) return feError('登录类型丢失, 请重试');
  if (!code) return feError('未收到授权码');

  const meta = getJuheTypeMeta(type);
  if (!meta) return feError('不支持的登录方式');

  try {
    const info = await getAggregatedUserInfo(type, code);

    // 查找或创建账号
    let account = await prisma.account.findUnique({
      where: { provider_providerUid: { provider: meta.provider, providerUid: info.social_uid } },
    });

    let user: any;
    let linked = false;

    if (account) {
      user = await prisma.user.findUnique({ where: { id: account.userId } });
      if (user?.status === UserStatus.BANNED) return feError('您的账号被永久封禁, 请联系管理员');
      linked = true;
    }

    if (!user) {
      // 新用户
      const baseName = (info.nickname || info.social_uid).slice(0, 24);
      let nickname = baseName;
      let i = 0;
      while (await prisma.user.findFirst({ where: { nickname } })) {
        i += 1;
        nickname = `${baseName.slice(0, 20)}_${i}`;
      }
      user = await prisma.user.create({
        data: { nickname, avatar: info.faceimg || null },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          provider: meta.provider,
          providerUid: info.social_uid,
          rawProfile: { type, ...info } as any,
        },
      });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    const params = new URLSearchParams({
      token,
      linked: String(linked),
      nickname: user.nickname,
    });
    const res = NextResponse.redirect(`${origin}/oauth/callback?${params.toString()}`);
    res.cookies.delete('oauth_state');
    res.cookies.delete('juhe_type');
    return res;
  } catch (e: any) {
    return feError(e?.message || '聚合登录失败');
  }
}
