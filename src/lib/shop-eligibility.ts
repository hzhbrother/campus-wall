// 积分商城兑换规则校验
import type { ShopItem, User } from '@prisma/client';

export interface AccessRule {
  type: 'GRADE' | 'CLASS' | 'ROLE' | 'VERIFIED';
  value: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员', TEACHER: '教师', SUPER_ADMIN: '超级管理员',
  VERIFIED: '认证用户', QUALIFIED: '资质认证用户', STUDENT: '学生',
};

/**
 * 检查用户是否满足商品的兑换条件
 */
export function checkExchangeEligibility(item: ShopItem, user: User): EligibilityResult {
  const reasons: string[] = [];

  // ---- 1. 兑换门槛: 墙龄 + 金币 ----
  const mode = item.thresholdMode || 'NONE';
  const hasDays = item.daysThreshold != null;
  const hasCoins = item.coinThreshold != null;

  if (mode !== 'NONE' && (hasDays || hasCoins)) {
    // 计算墙龄天数
    const daysRegistered = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    const daysOk = !hasDays || daysRegistered >= (item.daysThreshold as number);
    const coinsOk = !hasCoins || user.coins >= (item.coinThreshold as number);

    if (mode === 'DAYS' || mode === 'ALL') {
      if (!daysOk) reasons.push(`需要墙龄 ≥ ${item.daysThreshold} 天`);
    }
    if (mode === 'COINS' || mode === 'ALL') {
      if (!coinsOk) reasons.push(`需要金币 ≥ ${item.coinThreshold}`);
    }
    if (mode === 'ANY') {
      if (!daysOk && !coinsOk) {
        reasons.push(`需要墙龄 ≥ ${item.daysThreshold} 天 或金币 ≥ ${item.coinThreshold}`);
      }
    }
  }

  // ---- 2. 人群限制: 动态条件列表 ----
  const rules: AccessRule[] = Array.isArray(item.accessRules) ? item.accessRules as AccessRule[] : [];
  for (const rule of rules) {
    switch (rule.type) {
      case 'GRADE':
        if (!user.grade || user.grade !== rule.value) {
          reasons.push(`仅限「${rule.value}」年级兑换`);
        }
        break;
      case 'CLASS':
        if (!user.className || user.className !== rule.value) {
          reasons.push(`仅限「${rule.value}」班级兑换`);
        }
        break;
      case 'ROLE':
        if (user.role !== rule.value) {
          reasons.push(`仅限${ROLE_LABELS[rule.value] || rule.value}兑换`);
        }
        break;
      case 'VERIFIED':
        if (!user.verified) {
          reasons.push(`仅限认证用户兑换`);
        }
        break;
    }
  }

  // ---- 3. 积分是否足够 (兑换花费) ----
  if (user.points < item.pointsCost) {
    reasons.push(`积分不足, 需要 ${item.pointsCost} 积分`);
  }

  return { eligible: reasons.length === 0, reasons };
}
