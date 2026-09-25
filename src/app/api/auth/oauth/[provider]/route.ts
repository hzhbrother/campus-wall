// GET /api/auth/oauth/:provider  重定向到第三方授权页
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { AccountProvider } from '@prisma/client';
import { isProviderConfigured, getAuthorizeUrl } from '@/lib/oauth';
import { requestOrigin } from '@/lib/api-response';

const MAP: Record<string, AccountProvider> = {
  github: AccountProvider.GITHUB,
  google: AccountProvider.GOOGLE,
  wechat: AccountProvider.WECHAT,
  qq: AccountProvider.QQ,
  weibo: AccountProvider.WEIBO,
};

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = MAP[params.provider];
  if (!provider) return NextResponse.json({ message: '不支持的登录方式' }, { status: 400 });
  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { message: `登录方式 ${params.provider} 暂未配置凭据, 请在 Vercel 环境变量填入对应 APP_ID/SECRET` },
      { status: 503 }
    );
  }
  const state = randomBytes(8).toString('hex');
  const origin = requestOrigin(req);
  const url = getAuthorizeUrl(provider, state, origin);
  const res = NextResponse.redirect(url);
  res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
