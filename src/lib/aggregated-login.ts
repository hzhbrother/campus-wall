// 聚合登录 (彩虹云 / u.cccyun.cc) 对接
// 文档: https://u.cccyun.cc/doc.php
// 只需一对 App ID / App Key, 即可接入 QQ/微信/支付宝/微博/百度/华为/小米/抖音/哔哩哔哩/钉钉
// 凭证与接口地址优先从站点配置 (site_config: juhe_app_id / juhe_app_key / juhe_endpoint) 读取, 未配置时回退到环境变量
// 实现参考: github.com/laoshuikaixue/VoiceHub (server/utils/oauth-strategies.ts)
import { getSiteConfigValue } from './site-config';
import { JUHE_TYPES, getJuheTypeMeta } from './aggregated-login-types';

export { getJuheTypeMeta };

// 默认彩虹云接口地址; 若该域名拦截服务器 IP, 管理员可在后台更换接口地址
const DEFAULT_JUHE_API = 'https://u.cccyun.cc/connect.php';
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

// CDN/WAF 挑战页特征 (Cloudflare / 百度云加速等), 命中说明请求被安全防护拦截
const CHALLENGE_RE = /<html|just a moment|cloudflare|cf-chl-|enable javascript/i;

// 解析彩虹云响应: 非 JSON 时区分 WAF 拦截与异常响应
async function parseJuheResponse(res: Response): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* 非 JSON */ }
  if (data && typeof data === 'object') return data;
  if (CHALLENGE_RE.test(text)) {
    throw new Error('聚合登录供应商的安全防护拦截了服务器请求, 请将服务器出口 IP 加白或在后台更换接口地址');
  }
  throw new Error(`第三方登录服务响应异常 (${res.status}), 请稍后重试`);
}

// 彩虹云成功码可能是数字 0 或字符串 '0'
const isOkCode = (code: unknown): boolean =>
  code === 0 || (typeof code === 'string' && code.trim() === '0');

// 接口地址规范化: 仅允许 http/https, 去掉 query/hash 和末尾斜杠
function normalizeEndpoint(raw?: string | null): string {
  const value = (raw || '').trim() || DEFAULT_JUHE_API;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('聚合登录接口地址配置错误, 请在后台检查');
  }
}

interface JuheConfig { appId: string; appKey: string; endpoint: string }

// 配置缓存: 避免每次登录/绑定都查数据库 (60 秒内复用)
let cfgCache: { cfg: JuheConfig; at: number } | null = null;
const CFG_TTL_MS = 60 * 1000;

// 动态读取聚合登录配置: 站点配置优先, 环境变量兜底
async function getJuheConfig(): Promise<JuheConfig> {
  if (cfgCache && Date.now() - cfgCache.at < CFG_TTL_MS) return cfgCache.cfg;
  const [appIdCfg, appKeyCfg, endpointCfg] = await Promise.all([
    getSiteConfigValue('juhe_app_id'),
    getSiteConfigValue('juhe_app_key'),
    getSiteConfigValue('juhe_endpoint'),
  ]);
  const cfg: JuheConfig = {
    appId: appIdCfg || process.env.JUHE_APP_ID || '',
    appKey: appKeyCfg || process.env.JUHE_APP_KEY || '',
    endpoint: normalizeEndpoint(endpointCfg || process.env.JUHE_ENDPOINT),
  };
  cfgCache = { cfg, at: Date.now() };
  return cfg;
}

export async function isAggregatedLoginConfigured(): Promise<boolean> {
  const { appId, appKey } = await getJuheConfig();
  return !!appId && !!appKey;
}

// Step1: 获取跳转登录地址
// 彩虹云返回 { code, msg, url, qrcode? }
// 微信/支付宝等扫码登录会额外返回 qrcode 字段
export async function getAggregatedLoginUrl(
  type: string,
  redirectUri: string
): Promise<{ url: string; qrcode?: string }> {
  const { appId, appKey, endpoint } = await getJuheConfig();
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
  const res = await juheFetch(`${endpoint}?${params.toString()}`);
  const data = await parseJuheResponse(res);
  if (!isOkCode(data.code) || !data.url) {
    throw new Error(data.msg || '获取聚合登录地址失败');
  }
  // 校验返回的授权地址协议, 防止被重定向到 javascript: 等危险地址
  try {
    const u = new URL(data.url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad');
  } catch {
    throw new Error('聚合登录返回了无效的授权地址');
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
  const { appId, appKey, endpoint } = await getJuheConfig();
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
  const res = await juheFetch(`${endpoint}?${params.toString()}`);
  const data = await parseJuheResponse(res);
  // code=2: 用户未完成登录/取消授权
  if (data.code === 2 || data.code === '2') {
    throw new Error('您取消了登录授权，请重试');
  }
  if (!isOkCode(data.code)) {
    throw new Error(data.msg || '聚合登录获取用户信息失败');
  }
  return data as JuheUserInfo;
}
