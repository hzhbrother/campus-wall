// 头像 AI 审核 + 人工审核流程
// 三级风险模型:
//   low    → AI 自动通过 (pendingAvatar 直接应用为正式头像)
//   medium → 人工审核 (avatarStatus=PENDING, 进入管理员后台审核)
//   high   → AI 自动驳回 (avatarStatus=REJECTED, 通知用户原因)

export interface ModerationResult {
  passed: boolean;       // 是否允许进入下一步 (low/medium 为 true, high 为 false)
  riskLevel: 'low' | 'medium' | 'high';
  reason: string | null; // high 风险时的驳回原因
}

// 违规内容类型 (供 AI 审核 API 返回, 或用于本地兜底)
const VIOLATION_TYPES = [
  '政治敏感', '管制道具', '危险物品', '色情低俗', '暴力血腥', '违法广告', '侵犯隐私',
] as const;

// 调用外部 AI 审核 API (需配置 MODERATION_API_URL)
// API 需返回: { riskLevel: 'low'|'medium'|'high', reason?: string }
async function callModerationApi(imageBase64: string): Promise<ModerationResult | null> {
  const apiUrl = process.env.MODERATION_API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const riskLevel = data.riskLevel || 'medium';
    if (riskLevel === 'high') {
      return { passed: false, riskLevel: 'high', reason: data.reason || '图片包含不适宜内容' };
    }
    if (riskLevel === 'low') {
      return { passed: true, riskLevel: 'low', reason: null };
    }
    return { passed: true, riskLevel: 'medium', reason: null };
  } catch {
    return null;
  }
}

// 头像审核主入口: 返回审核结果, 由调用方决定后续处理
// - low:    直接通过 (应用头像)
// - medium: 进入人工审核队列
// - high:   自动驳回
export async function moderateAvatar(imageBase64: string): Promise<ModerationResult> {
  // 1. 优先调用外部 AI 审核 API
  const apiResult = await callModerationApi(imageBase64);
  if (apiResult) return apiResult;

  // 2. 未配置 API → 默认进入人工审核 (medium)
  //    这样所有头像都需要管理员确认, 避免违规内容直接通过
  return { passed: true, riskLevel: 'medium', reason: null };
}
