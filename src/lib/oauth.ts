// 第三方 OAuth 提供方配置与对接 (从 NestJS 移植)
// 支持配置: GitHub / Google / WeChat / QQ / Weibo
// 未配置凭据的提供方在路由层直接返回 503 提示

import { AccountProvider } from '@prisma/client';

export interface OAuthProfile {
  provider: AccountProvider;
  providerUid: string;
  nickname: string;
  avatar?: string;
  email?: string;
  raw: any;
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
}

function cfg(provider: AccountProvider): ProviderConfig | null {
  const id = (k: string) => process.env[k] || '';
  switch (provider) {
    case AccountProvider.GITHUB:
      return {
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        profileUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        clientId: id('GITHUB_CLIENT_ID'),
        clientSecret: id('GITHUB_CLIENT_SECRET'),
      };
    case AccountProvider.GOOGLE:
      return {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scope: 'openid email profile',
        clientId: id('GOOGLE_CLIENT_ID'),
        clientSecret: id('GOOGLE_CLIENT_SECRET'),
      };
    case AccountProvider.WECHAT:
      return {
        authorizeUrl: 'https://open.weixin.qq.com/connect/qrconnect',
        tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
        profileUrl: 'https://api.weixin.qq.com/sns/userinfo',
        scope: 'snsapi_login',
        clientId: id('WECHAT_APP_ID'),
        clientSecret: id('WECHAT_APP_SECRET'),
      };
    case AccountProvider.QQ:
      return {
        authorizeUrl: 'https://graph.qq.com/oauth2.0/authorize',
        tokenUrl: 'https://graph.qq.com/oauth2.0/token',
        profileUrl: 'https://graph.qq.com/user/get_user_info',
        scope: 'get_user_info',
        clientId: id('QQ_APP_ID'),
        clientSecret: id('QQ_APP_KEY'),
      };
    case AccountProvider.WEIBO:
      return {
        authorizeUrl: 'https://api.weibo.com/oauth2/authorize',
        tokenUrl: 'https://api.weibo.com/oauth2/access_token',
        profileUrl: 'https://api.weibo.com/2/users/show.json',
        scope: '',
        clientId: id('WEIBO_APP_KEY'),
        clientSecret: id('WEIBO_APP_SECRET'),
      };
    default:
      return null;
  }
}

export function isProviderConfigured(provider: AccountProvider): boolean {
  const c = cfg(provider);
  return !!(c && c.clientId && c.clientSecret);
}

export function getAuthorizeUrl(provider: AccountProvider, state: string, callbackBase: string): string {
  const c = cfg(provider);
  if (!c) throw new Error('不支持的登录方式');
  const redirectUri = `${callbackBase}/api/auth/callback/${provider.toLowerCase()}`;
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    state,
    ...(provider === AccountProvider.WECHAT ? {} : { response_type: 'code' }),
    ...(c.scope ? { scope: c.scope } : {}),
  });
  return `${c.authorizeUrl}?${params.toString()}`;
}

// 用 code 换取 access_token 并拉取用户资料 (Node 18+ 内置 fetch)
export async function fetchProfile(provider: AccountProvider, code: string, callbackBase: string): Promise<OAuthProfile> {
  const c = cfg(provider);
  if (!c) throw new Error('不支持的登录方式');
  const redirectUri = `${callbackBase}/api/auth/callback/${provider.toLowerCase()}`;

  // 1. code -> token
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: c.clientId,
    client_secret: c.clientSecret,
  });
  const tokenRes = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams,
  });
  const tokenText = await tokenRes.text();
  // 部分渠道 (如 QQ) 返回 application/x-www-form-urlencoded 而非 JSON
  let token: any;
  if (tokenText.trim().startsWith('{')) {
    token = JSON.parse(tokenText);
  } else {
    token = Object.fromEntries(new URLSearchParams(tokenText));
  }
  const accessToken = token.access_token;
  if (!accessToken) throw new Error('获取 access_token 失败: ' + tokenText);

  // 2. token -> profile
  let profile: any;
  if (provider === AccountProvider.GITHUB) {
    const r = await fetch(c.profileUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    profile = await r.json();
    return {
      provider,
      providerUid: String(profile.id),
      nickname: profile.name || profile.login,
      avatar: profile.avatar_url,
      email: profile.email,
      raw: profile,
    };
  }
  if (provider === AccountProvider.GOOGLE) {
    const r = await fetch(c.profileUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    profile = await r.json();
    return {
      provider,
      providerUid: String(profile.id),
      nickname: profile.name,
      avatar: profile.picture,
      email: profile.email,
      raw: profile,
    };
  }
  if (provider === AccountProvider.WECHAT) {
    const r = await fetch(`${c.profileUrl}?access_token=${accessToken}&openid=${token.openid}`);
    profile = await r.json();
    return {
      provider,
      providerUid: String(profile.openid),
      nickname: profile.nickname,
      avatar: profile.headimgurl,
      raw: profile,
    };
  }
  if (provider === AccountProvider.QQ) {
    const r = await fetch(`${c.profileUrl}?access_token=${accessToken}&oauth_consumer_key=${c.clientId}&openid=${token.openid}`);
    profile = await r.json();
    return {
      provider,
      providerUid: String(token.openid),
      nickname: profile.nickname,
      avatar: profile.figureurl_qq_2,
      raw: profile,
    };
  }
  if (provider === AccountProvider.WEIBO) {
    const uidRes = await fetch(`https://api.weibo.com/oauth2/get_uids?access_token=${accessToken}`);
    const uidJson = await uidRes.json();
    const uid = String(uidJson.uid || uidJson.uids?.[0]?.uid);
    const r = await fetch(`${c.profileUrl}?access_token=${accessToken}&uid=${uid}`);
    profile = await r.json();
    return {
      provider,
      providerUid: uid,
      nickname: profile.screen_name,
      avatar: profile.avatar_large,
      raw: profile,
    };
  }
  throw new Error('未实现的登录方式');
}
