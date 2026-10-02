// 第三方登录品牌官方 SVG 图标 (使用 simple-icons 官方包, 确保路径准确)
import React from 'react';
import {
  siQq,
  siWechat,
  siAlipay,
  siSinaweibo,
  siBaidu,
  siHuawei,
  siXiaomi,
  siTiktok,
  siBilibili,
} from 'simple-icons';

type BrandIconProps = {
  type: string;
  size?: number;
  className?: string;
};

// type -> simple-icons 图标对象 + 品牌主色
const ICON_MAP: Record<string, { path: string; hex: string }> = {
  qq: { path: siQq.path, hex: '#' + siQq.hex },
  wx: { path: siWechat.path, hex: '#' + siWechat.hex },
  alipay: { path: siAlipay.path, hex: '#' + siAlipay.hex },
  sina: { path: siSinaweibo.path, hex: '#' + siSinaweibo.hex },
  baidu: { path: siBaidu.path, hex: '#' + siBaidu.hex },
  huawei: { path: siHuawei.path, hex: '#' + siHuawei.hex },
  xiaomi: { path: siXiaomi.path, hex: '#' + siXiaomi.hex },
  douyin: { path: siTiktok.path, hex: '#000000' },
  bilibili: { path: siBilibili.path, hex: '#' + siBilibili.hex },
  // 钉钉: simple-icons 未收录, 使用官方品牌路径
  dingtalk: {
    path: 'M18.461 8.234c-.293-.06-.61-.088-.942-.088-.89 0-1.737.16-2.503.451l-.073-.101c-.17-.246-.365-.472-.578-.677-.54-.52-1.17-.9-1.862-1.124-.692-.224-1.427-.336-2.178-.336-1.253 0-2.43.315-3.48.896-.08.043-.157.09-.233.142A6.66 6.66 0 0 0 2.12 9.373a6.7 6.7 0 0 0-1.106 3.158 6.68 6.68 0 0 0 .355 2.648 6.67 6.67 0 0 0 1.127 2.131 6.66 6.66 0 0 0 1.772 1.565 6.67 6.67 0 0 0 2.299.912h.01c-.063.266-.097.541-.097.823 0 1.09.384 2.092 1.018 2.858.634.765 1.488 1.189 2.392 1.189.892 0 1.74-.412 2.381-1.142.64-.73.999-1.727.999-2.787 0-1.03-.34-2.012-.95-2.788.693-.22 1.364-.52 1.985-.885l2.404 1.632c.03.02.06.04.09.06.527.336 1.114.5 1.698.46.56-.038 1.096-.26 1.508-.616.413-.356.69-.82.8-1.332.11-.512.06-1.04-.14-1.523-.195-.478-.52-.883-.94-1.168l-1.164-.785.42-1.182c.063-.17.098-.352.104-.537.006-.186-.022-.37-.083-.544a1.41 1.41 0 0 0-.246-.443 1.387 1.387 0 0 0-.408-.295 1.4 1.4 0 0 0-.54-.156 1.4 1.4 0 0 0-.275.018zM9.28 20.82c-1.24 0-2.247-.945-2.247-2.11 0-1.165 1.007-2.11 2.247-2.11 1.24 0 2.247.945 2.247 2.11 0 1.165-1.007 2.11-2.247 2.11z',
    hex: '#1677FF',
  },
};

export function BrandIcon({ type, size = 24, className = '' }: BrandIconProps) {
  const icon = ICON_MAP[type];
  if (!icon) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={icon.hex}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <path d={icon.path} />
    </svg>
  );
}

// 抖音特殊处理: 黑底 + 红青渐变描边 (近似官方视觉)
export function DouyinIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  const icon = ICON_MAP.douyin;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="douyinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FE2C55" />
          <stop offset="100%" stopColor="#25F4EE" />
        </linearGradient>
      </defs>
      <path d={icon.path} fill="#000" />
      <path d={icon.path} fill="none" stroke="url(#douyinGrad)" strokeWidth="0.5" />
    </svg>
  );
}

export function getBrandColor(type: string): string {
  return ICON_MAP[type]?.hex || '#666';
}
