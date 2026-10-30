// 用户编号生成与展示
// 规则:
// - 所有用户统一顺序编号, 从 1 开始
// - 身份认证已取消, 所有用户统一 XY 前缀

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
 */
export function formatUserCode(userNumber: number | null | undefined): string {
  if (userNumber == null) return '';
  const padded = String(userNumber).padStart(5, '0');
  return `XY${padded}`;
}
