// 头像 AI 审核 + 人工审核流程
// AI 审核是前置自动检查 (可配置外部 API), 人工审核是最终决定

export interface ModerationResult {
  passed: boolean;      // AI 初筛是否通过
  reason: string | null; // 不通过原因
  riskLevel: 'low' | 'medium' | 'high';
}

// AI 初筛: 检查图片是否疑似含政治敏感内容
// 如果配置了 MODERATION_API_URL 环境变量, 调用外部审核 API
// 否则默认通过 (交给人工审核最终决定)
export async function moderateAvatar(imageBase64: string): Promise<ModerationResult> {
  // 如果有外部审核 API
  const apiUrl = process.env.MODERATION_API_URL;
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });
      const data = await res.json();
      return {
        passed: data.passed,
        reason: data.reason || null,
        riskLevel: data.riskLevel || 'low',
      };
    } catch {
      // API 调用失败, 默认通过交给人工
      return { passed: true, reason: null, riskLevel: 'low' };
    }
  }
  // 没有配置 API, 默认通过 (人工审核兜底)
  return { passed: true, reason: null, riskLevel: 'low' };
}
