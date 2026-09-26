// 用户编号生成与展示
// 规则:
// - 所有用户统一顺序编号, 从 1 开始
// 展示:
// - 未认证 (预备): XYS + 补零到 5 位, 如 XYS00001
// - 已认证: XY + 补零到 5 位, 如 XY00001

import { prisma } from '@/lib/prisma';

/**
 * 生成下一个用户编号 (全用户统一顺序, 从 1 开始)
 */
export async function generateUserNumber(): Promise<number> {
  const aggregate = await prisma.user.aggregate({
    _max: { userNumber: true },
  });
  const max = aggregate._max.userNumber;
  if (max == null) return 1;
  return max + 1;
}

/**
 * 格式化用户编号为展示字符串
 * @param userNumber 顺序号
 * @param verified 是否已认证
 */
export function formatUserCode(userNumber: number | null | undefined, verified: boolean): string {
  if (userNumber == null) return '';
  const prefix = verified ? 'XY' : 'XYS';
  const padded = String(userNumber).padStart(5, '0');
  return `${prefix}${padded}`;
}
