// 用户编号生成与展示
// 规则:
// - 普通用户: 顺序号从 1 开始
// - 超级管理员: 顺序号从 100000001 开始
// 展示:
// - 未认证 (预备): XYS + 补零编号, 如 XYS00001
// - 已认证: XY + 补零编号, 如 XY00001

import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

const ADMIN_NUMBER_BASE = 100000001;

/**
 * 生成下一个用户编号
 * @param role 用户角色, SUPER_ADMIN 使用管理员号段
 */
export async function generateUserNumber(role: UserRole | string): Promise<number> {
  const isAdmin = role === UserRole.SUPER_ADMIN;
  const aggregate = await prisma.user.aggregate({
    _max: { userNumber: true },
    where: isAdmin
      ? { userNumber: { gte: ADMIN_NUMBER_BASE } }
      : { OR: [{ userNumber: { lt: ADMIN_NUMBER_BASE } }, { userNumber: null }] },
  });
  const max = aggregate._max.userNumber;
  if (max == null) {
    return isAdmin ? ADMIN_NUMBER_BASE : 1;
  }
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
  // 普通用户补零到 5 位, 管理员号段不补零
  const padded = userNumber >= ADMIN_NUMBER_BASE
    ? String(userNumber)
    : String(userNumber).padStart(5, '0');
  return `${prefix}${padded}`;
}
