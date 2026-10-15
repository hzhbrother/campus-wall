// 积分商城兑换规则校验
// 检查用户是否满足商品的兑换门槛和人群限制
import type { ShopItem, User } from '@prisma/client';

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];  // 未满足的原因列表
}

/**
 * 检查用户是否满足商品的兑换条件
 * @param item 商品
 * @param user 用户
 * @returns eligible=true 表示可以兑换, reasons 为空
 */
export function checkExchangeEligibility(item: ShopItem, user: User): EligibilityResult {
  const reasons: string[] = [];

  // ---- 1. 兑换门槛校验 ----
  const mode = item.thresholdMode || 'NONE';
  const hasPointsThreshold = item.pointsThreshold != null;
  const hasCoinThreshold = item.coinThreshold != null;

  if (mode !== 'NONE' && (hasPointsThreshold || hasCoinThreshold)) {
    const pointsOk = !hasPointsThreshold || user.points >= (item.pointsThreshold as number);
    const coinsOk = !hasCoinThreshold || user.coins >= (item.coinThreshold as number);

    if (mode === 'ALL') {
      // 同时满足
      if (!pointsOk) reasons.push(`需要点数 ≥ ${item.pointsThreshold}`);
      if (!coinsOk) reasons.push(`需要金币 ≥ ${item.coinThreshold}`);
    } else if (mode === 'ANY') {
      // 满足其一
      if (!pointsOk && !coinsOk) {
        reasons.push(`需要点数 ≥ ${item.pointsThreshold} 或金币 ≥ ${item.coinThreshold}`);
      }
    }
  }

  // ---- 2. 人群限制校验 ----
  const hasGradeLimit = item.allowedGrades.length > 0;
  const hasClassLimit = item.allowedClasses.length > 0;
  const hasRoleLimit = item.allowedRoles.length > 0;

  if (hasGradeLimit && user.grade) {
    if (!item.allowedGrades.includes(user.grade)) {
      reasons.push(`仅限 ${item.allowedGrades.join('/')} 用户兑换`);
    }
  } else if (hasGradeLimit && !user.grade) {
    reasons.push(`仅限 ${item.allowedGrades.join('/')} 用户兑换`);
  }

  if (hasClassLimit && user.className) {
    if (!item.allowedClasses.includes(user.className)) {
      reasons.push(`仅限 ${item.allowedClasses.join('/')} 班级兑换`);
    }
  } else if (hasClassLimit && !user.className) {
    reasons.push(`仅限 ${item.allowedClasses.join('/')} 班级兑换`);
  }

  if (hasRoleLimit) {
    // 用户的身份标签: 角色 + 认证状态
    const userTags: string[] = [user.role];
    if (user.verified) userTags.push('VERIFIED');
    if (user.qualificationVerified) userTags.push('QUALIFIED');
    const matched = item.allowedRoles.some(r => userTags.includes(r));
    if (!matched) {
      const roleLabels: Record<string, string> = {
        ADMIN: '管理员', TEACHER: '教师', SUPER_ADMIN: '超级管理员',
        VERIFIED: '认证用户', QUALIFIED: '资质认证用户', STUDENT: '学生',
      };
      const labels = item.allowedRoles.map(r => roleLabels[r] || r).join('/');
      reasons.push(`仅限 ${labels} 兑换`);
    }
  }

  // ---- 3. 积分是否足够 (兑换花费) ----
  if (user.points < item.pointsCost) {
    reasons.push(`积分不足, 需要 ${item.pointsCost} 积分`);
  }

  return { eligible: reasons.length === 0, reasons };
}
