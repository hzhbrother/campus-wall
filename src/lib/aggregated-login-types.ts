// 聚合登录类型的纯常量 (客户端安全: 不引入 Prisma / 服务端依赖)
// 客户端组件请从这里导入 JUHE_TYPES, 不要从 '@/lib/aggregated-login' 导入
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

export type JuheTypeMeta = (typeof JUHE_TYPES)[number];

export function getJuheTypeMeta(type: string) {
  return JUHE_TYPES.find(t => t.type === type);
}
