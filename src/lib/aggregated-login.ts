// 聚合登录 (彩虹云 / u.cccyun.cc) 对接
// 文档: https://u.cccyun.cc/doc.php
// 只需一对 App ID / App Key, 即可接入 QQ/微信/支付宝/微博/百度/华为/小米/抖音/哔哩哔哩/钉钉
// 凭证优先从站点配置 (site_config: juhe_app_id / juhe_app_key) 读取, 未配置时回退到环境变量
import { getSiteConfigValue } from './site-config';

const JUHE_API = 'https://u.cccyun.cc/connect.php';

// 动态读取聚合登录凭证: 站点配置优先, 环境变量兜底
async function getJuheCredentials(): Promise<{ appId: string; appKey: string }> {
  const appId = (await getSiteConfigValue('juhe_app_id')) || process.env.JUHE_APP_ID || '';
  const appKey = (await getSiteConfigValue('juhe_app_key')) || process.env.JUHE_APP_KEY || '';
  return { appId, appKey };
}

// 聚合登录支持的类型 (provider 对应 AccountProvider 枚举值)
// 对齐彩虹云官方文档支持的 10 种登录方式
export const JUHE_TYPES = [
  { type: 'qq',       label: 'QQ',       provider: 'QQ' },
  { type: 'wx',       label: '微信',     provider: 'WECHAT' },
  { type: 'alipay',   label: '支付宝',   provider: 'ALIPAY' },
  { type: 'sina',     label: '微博',     provider: 'WEIBO' },
  { type: 'baidu',    label: '百度',     provider: 'BAIDU' },
  { type: 'huawei',   label: '华为',     provider: 'HUAWEI' },
  { type: 'xiaomi',   label: '小米',     provider: 'XIAOMI' },
  { type: 'douyin',   label: '抖音',     provider: 'DOUYIN' },
  { type: 'bilibili', label: '哔哩哔哩', provider: 'BILIBILI' },
  { type: 'dingtalk', label: '钉钉',     provider: 'DINGTALK' },
] as const;

export async function isAggregatedLoginConfigured(): Promise<boolean> {
  const { appId, appKey } = await getJuheCredentials();
  return !!appId && !!appKey;
}

export function getJuheTypeMeta(type: string) {
  return JUHE_TYPES.find(t => t.type === type);
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
  const res = await fetch(`${JUHE_API}?${params.toString()}`);
  const data = await res.json();
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
  const res = await fetch(`${JUHE_API}?${params.toString()}`);
  const data = await res.json();
  // code=2: 用户未完成登录/取消授权
  if (data.code === 2) {
    throw new Error('您取消了登录授权，请重试');
  }
  if (data.code !== 0) {
    throw new Error(data.msg || '聚合登录获取用户信息失败');
  }
  return data as JuheUserInfo;
}
