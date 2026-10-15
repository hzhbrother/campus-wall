// 积分商城兑换规则校验
import type { ShopItem, User } from '@prisma/client';

export interface ShopCondition {
  type: 'DAYS' | 'COINS' | 'GRADE' | 'CLASS' | 'ROLE' | 'VERIFIED';
  value: string | number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员', TEACHER: '教师', SUPER_ADMIN: '超级管理员', STUDENT: '学生',
};

/**
 * 检查用户是否满足商品的兑换条件
 * conditions 为条件列表, conditionMode 决定条件间关系 (ALL=全部满足, ANY=满足任一)
 */
export function checkExchangeEligibility(item: ShopItem, user: User): EligibilityResult {
  const reasons: string[] = [];

  // ---- 1. 积分是否足够 (兑换花费, 独立于 conditions) ----
  if (user.points < item.pointsCost) {
    reasons.push(`积分不足, 需要 ${item.pointsCost} 积分`);
  }

  // ---- 2. 动态条件列表 ----
  const conditions: ShopCondition[] = Array.isArray(item.conditions) ? item.conditions as unknown as ShopCondition[] : [];
  if (conditions.length === 0) {
    return { eligible: reasons.length === 0, reasons };
  }

  const mode = item.conditionMode || 'ALL';
  const results: { ok: boolean; reason: string }[] = conditions.map(c => {
    switch (c.type) {
      case 'DAYS': {
        const daysRegistered = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        const need = Number(c.value);
        return { ok: daysRegistered >= need, reason: `墙龄需 ≥ ${need} 天` };
      }
      case 'COINS': {
        const need = Number(c.value);
        return { ok: user.coins >= need, reason: `金币需 ≥ ${need}` };
      }
      case 'GRADE':
        return { ok: user.grade === String(c.value), reason: `仅限「${c.value}」年级` };
      case 'CLASS':
        return { ok: user.className === String(c.value), reason: `仅限「${c.value}」班级` };
      case 'ROLE':
        return { ok: user.role === String(c.value), reason: `仅限${ROLE_LABELS[String(c.value)] || c.value}` };
      case 'VERIFIED':
        return { ok: !!user.verified, reason: '仅限认证用户' };
      default:
        return { ok: true, reason: '' };
    }
  });

  if (mode === 'ALL') {
    // 全部满足: 收集所有不满足的原因
    results.forEach(r => { if (!r.ok) reasons.push(r.reason); });
  } else {
    // 满足任一: 全部不满足才提示
    if (results.every(r => !r.ok)) {
      reasons.push(`需满足以下任一条件: ${results.map(r => r.reason).join(' 或 ')}`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
