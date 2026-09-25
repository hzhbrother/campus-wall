// 聚合登录 (聚合云 / juhedenglu.cn) 对接
// 文档: https://www.juhedenglu.cn/help/developer.html
// 只需一对 JUHE_APP_ID / JUHE_APP_KEY, 即可接入 QQ/微信/微博/支付宝/百度/抖音/华为/小米/Google/GitHub 等

const JUHE_APP_ID = process.env.JUHE_APP_ID || '';
const JUHE_APP_KEY = process.env.JUHE_APP_KEY || '';
const JUHE_API = 'https://open.juhedenglu.cn/connect.php';

// 聚合登录支持的类型 (provider 对应 AccountProvider 枚举值)
export const JUHE_TYPES = [
  { type: 'qq',        label: 'QQ',      icon: '🐧', provider: 'QQ' },
  { type: 'wx',        label: '微信',    icon: '💬', provider: 'WECHAT' },
  { type: 'sina',      label: '微博',    icon: '🌐', provider: 'WEIBO' },
  { type: 'alipay',    label: '支付宝',  icon: '💰', provider: 'ALIPAY' },
  { type: 'baidu',     label: '百度',    icon: '🐾', provider: 'BAIDU' },
  { type: 'douyin',    label: '抖音',    icon: '🎵', provider: 'DOUYIN' },
  { type: 'huawei',    label: '华为',    icon: '📱', provider: 'HUAWEI' },
  { type: 'xiaomi',    label: '小米',    icon: '📲', provider: 'QQ' },
  { type: 'gitee',     label: 'Gitee',   icon: '🐙', provider: 'GITHUB' },
  { type: 'github',    label: 'GitHub',  icon: '🐱', provider: 'GITHUB' },
  { type: 'google',    label: 'Google',  icon: '🔍', provider: 'GOOGLE' },
  { type: 'microsoft', label: '微软',    icon: '🪟', provider: 'GOOGLE' },
] as const;

export function isAggregatedLoginConfigured(): boolean {
  return !!JUHE_APP_ID && !!JUHE_APP_KEY;
}

export function getJuheTypeMeta(type: string) {
  return JUHE_TYPES.find(t => t.type === type);
}

// Step1: 获取跳转登录地址
export async function getAggregatedLoginUrl(
  type: string,
  redirectUri: string
): Promise<string> {
  if (!isAggregatedLoginConfigured()) {
    throw new Error('聚合登录未配置 JUHE_APP_ID / JUHE_APP_KEY');
  }
  const meta = getJuheTypeMeta(type);
  if (!meta) throw new Error('不支持的聚合登录类型: ' + type);

  const params = new URLSearchParams({
    act: 'login',
    appid: JUHE_APP_ID,
    appkey: JUHE_APP_KEY,
    type,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${JUHE_API}?${params.toString()}`);
  const data = await res.json();
  if (data.code !== 0 || !data.url) {
    throw new Error(data.msg || '获取聚合登录地址失败');
  }
  return data.url as string;
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
  if (!isAggregatedLoginConfigured()) {
    throw new Error('聚合登录未配置 JUHE_APP_ID / JUHE_APP_KEY');
  }
  const params = new URLSearchParams({
    act: 'callback',
    appid: JUHE_APP_ID,
    appkey: JUHE_APP_KEY,
    type,
    code,
  });
  const res = await fetch(`${JUHE_API}?${params.toString()}`);
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(data.msg || '聚合登录获取用户信息失败');
  }
  return data as JuheUserInfo;
}
