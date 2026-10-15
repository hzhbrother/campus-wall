// GET /api/auth/callback/:provider  OAuth 回调, 换 token + 落库 + 跳回前端
import { NextRequest, NextResponse } from 'next/server';
import { AccountProvider, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signToken, sanitize } from '@/lib/server-auth';
import { fetchProfile } from '@/lib/oauth';
import { requestOrigin } from '@/lib/api-response';
import { generateUserNumber } from '@/lib/user-number';

const MAP: Record<string, AccountProvider> = {
  github: AccountProvider.GITHUB,
  google: AccountProvider.GOOGLE,
  wechat: AccountProvider.WECHAT,
  qq: AccountProvider.QQ,
  weibo: AccountProvider.WEIBO,
};

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = MAP[params.provider];
  const origin = requestOrigin(req);
  const feError = (msg: string) => NextResponse.redirect(`${origin}/oauth/callback?error=${encodeURIComponent(msg)}`);

  if (!provider) return feError('不支持的登录方式');

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('oauth_state')?.value;

  if (!state || state !== cookieState) return feError('state 校验失败, 请重试');
  if (!code) return feError('未收到授权码');

  try {
    const profile = await fetchProfile(provider, code, origin);
    const account = await prisma.account.findUnique({
      where: { provider_providerUid: { provider, providerUid: profile.providerUid } },
    });

    let user: any;
    let linked = false;
    if (account) {
      user = await prisma.user.findUnique({ where: { id: account.userId } });
      if (user?.status === UserStatus.BANNED) return feError('您的账号被永久封禁, 请联系管理员');
      linked = true;
    } else if (profile.email) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        await prisma.account.create({
          data: { userId: user.id, provider, providerUid: profile.providerUid, rawProfile: profile.raw as any },
        });
        linked = true;
      }
    }
    if (!user) {
      // 不自动注册, 跳转到账号绑定页面
      const bindToken = signToken({
        sub: 'bind',
        provider,
        social_uid: profile.providerUid,
        nickname: profile.nickname,
        avatar: profile.avatar,
      } as any);
      const res = NextResponse.redirect(`${origin}/oauth/bind?bind_token=${encodeURIComponent(bindToken)}`);
      res.cookies.delete('oauth_state');
      return res;
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    const params = new URLSearchParams({
      token,
      linked: String(linked),
      nickname: user.nickname,
    });
    const res = NextResponse.redirect(`${origin}/oauth/callback?${params.toString()}`);
    res.cookies.delete('oauth_state');
    return res;
  } catch (e: any) {
    return feError(e?.message || '第三方登录失败');
  }
}
