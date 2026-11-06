// 聚合登录 (彩虹云 / u.cccyun.cc) 对接
// 文档: https://u.cccyun.cc/doc.php
// 只需一对 App ID / App Key, 即可接入 QQ/微信/支付宝/微博/百度/华为/小米/抖音/哔哩哔哩/钉钉
// 凭证优先从站点配置 (site_config: juhe_app_id / juhe_app_key) 读取, 未配置时回退到环境变量
import { getSiteConfigValue } from './site-config';
import { JUHE_TYPES, getJuheTypeMeta } from './aggregated-login-types';

export { getJuheTypeMeta };

const JUHE_API = 'https://u.cccyun.cc/connect.php';
const JUHE_TIMEOUT_MS = 12000;

// 彩虹云是国内面板服务, 常带 WAF/CC 防护, 默认 Node fetch 的 TLS 指纹容易被断连
// 这里带浏览器 UA 并重试, 规避偶发的 "fetch failed"
const JUHE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function juheFetch(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(JUHE_TIMEOUT_MS),
        cache: 'no-store',
        headers: { 'User-Agent': JUHE_UA, Accept: 'application/json' },
      });
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// 凭证缓存: 避免每次登录/绑定都查两次数据库 (60 秒内复用)
let credsCache: { appId: string; appKey: string; at: number } | null = null;
const CREDS_TTL_MS = 60 * 1000;

// 动态读取聚合登录凭证: 站点配置优先, 环境变量兜底
async function getJuheCredentials(): Promise<{ appId: string; appKey: string }> {
  if (credsCache && Date.now() - credsCache.at < CREDS_TTL_MS) {
    return { appId: credsCache.appId, appKey: credsCache.appKey };
  }
  const [appIdCfg, appKeyCfg] = await Promise.all([
    getSiteConfigValue('juhe_app_id'),
    getSiteConfigValue('juhe_app_key'),
  ]);
  const appId = appIdCfg || process.env.JUHE_APP_ID || '';
  const appKey = appKeyCfg || process.env.JUHE_APP_KEY || '';
  credsCache = { appId, appKey, at: Date.now() };
  return { appId, appKey };
}

export async function isAggregatedLoginConfigured(): Promise<boolean> {
  const { appId, appKey } = await getJuheCredentials();
  return !!appId && !!appKey;
}


// Step1: 获取跳转登录地址
// 彩虹云返回 { code, msg, url, qrcode? }
// 微信/支付宝等扫码登录会额外返回 qrcode 字段
export async function getAggregatedLoginUrl(
  type: string,
  redirectUri: string
): Promise<{ url: string; qrcode?: string }> {
  const { appId, appKey } = await getJuheCredentials();
  if (!appId || !appKey) {
    throw new Error('聚合登录未配置 App ID / App Key');
  }
  const meta = getJuheTypeMeta(type);
  if (!meta) throw new Error('不支持的聚合登录类型: ' + type);

  const params = new URLSearchParams({
    act: 'login',
    appid: appId,
    appkey: appKey,
    type,
    redirect_uri: redirectUri,
  });
  const res = await juheFetch(`${JUHE_API}?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(`第三方登录服务响应异常 (${res.status}), 请稍后重试`);
  }
  if (data.code !== 0 || !data.url) {
    throw new Error(data.msg || '获取聚合登录地址失败');
  }
  return { url: data.url as string, qrcode: data.qrcode as string | undefined };
}

// Step4: 通过 Authorization Code 获取用户信息
export interface JuheUserInfo {
  type: string;
  social_uid: string;
  access_token: string;
  nickname: string;
  faceimg?: string;
  gender?: string;
  location?: string;
  ip?: string;
}

export async function getAggregatedUserInfo(
  type: string,
  code: string
): Promise<JuheUserInfo> {
  const { appId, appKey } = await getJuheCredentials();
  if (!appId || !appKey) {
    throw new Error('聚合登录未配置 App ID / App Key');
  }
  const params = new URLSearchParams({
    act: 'callback',
    appid: appId,
    appkey: appKey,
    type,
    code,
  });
  const res = await juheFetch(`${JUHE_API}?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(`第三方登录服务响应异常 (${res.status}), 请稍后重试`);
  }
  // code=2: 用户未完成登录/取消授权
  if (data.code === 2) {
    throw new Error('您取消了登录授权，请重试');
  }
  if (data.code !== 0) {
    throw new Error(data.msg || '聚合登录获取用户信息失败');
  }
  return data as JuheUserInfo;
}
