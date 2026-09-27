// AI 图片真实性检测: 判断上传的认证照片是否存在 AI 生成痕迹
//
// 检测提供商 (通过环境变量 AI_IMAGE_DETECT_PROVIDER 选择):
//   1. hive      → Hive AI 图像鉴伪 (需 HIVE_API_KEY)
//   2. sensity   → Sensity AI 深度伪造检测 (需 SENSITY_API_KEY)
//   3. none      → 不检测 (默认)
//
// 检测结果结构:
//   { isAiGenerated: boolean, confidence: 'low'|'medium'|'high', note: string }

export interface AiImageCheckResult {
  isAiGenerated: boolean;       // 是否疑似 AI 生成
  confidence: 'low' | 'medium' | 'high'; // 置信度
  note: string;                 // 说明文字 (供审核员参考)
  provider?: string;            // 实际使用的检测提供商
  raw?: any;                    // 原始检测数据 (调试用)
}

const PROVIDER = (process.env.AI_IMAGE_DETECT_PROVIDER || 'none').toLowerCase();
const HIVE_API_KEY = process.env.HIVE_API_KEY || '';
const SENSITY_API_KEY = process.env.SENSITY_API_KEY || '';

/**
 * 检测图片是否存在 AI 生成痕迹
 * @param base64 图片的 base64 (含 data:image/...;base64, 前缀或纯 base64 均可)
 */
export async function detectAiImage(base64: string): Promise<AiImageCheckResult> {
  if (!base64) {
    return { isAiGenerated: false, confidence: 'low', note: '无图片数据' };
  }

  try {
    if (PROVIDER === 'hive' && HIVE_API_KEY) {
      return await detectWithHive(base64);
    }
    if (PROVIDER === 'sensity' && SENSITY_API_KEY) {
      return await detectWithSensity(base64);
    }

    // 未配置第三方检测服务: 返回低风险默认值, 标注"未检测"
    return {
      isAiGenerated: false,
      confidence: 'low',
      note: '未配置 AI 图片检测服务, 请人工复核',
      provider: 'none',
    };
  } catch (e: any) {
    // 检测失败不阻断提交流程, 返回未知状态
    return {
      isAiGenerated: false,
      confidence: 'low',
      note: `AI 检测异常: ${e?.message || '未知错误'}, 请人工复核`,
      provider: PROVIDER,
    };
  }
}

// ---------- Hive AI 图像鉴伪 ----------
// 文档: https://docs.thehive.ai/reference/post-visual-ai-generated-image-detection
async function detectWithHive(base64: string): Promise<AiImageCheckResult> {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const resp = await fetch('https://api.thehive.ai/api/v2/task/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${HIVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_public_url: cleanBase64.startsWith('http') ? cleanBase64 : undefined,
      image_raw: cleanBase64.startsWith('http') ? undefined : cleanBase64,
      options: { model: 'genai-detector' },
    }),
  });
  if (!resp.ok) throw new Error(`Hive API ${resp.status}`);
  const data = await resp.json();
  const output = data?.status?.[0]?.response?.output?.[0];
  // Hive 返回 classes: [{ class: 'ai_generated', score: 0.9 }, { class: 'not_ai_generated', score: 0.1 }]
  const aiScore = output?.classes?.find((c: any) => c.class === 'ai_generated')?.score ?? 0;
  const isAi = aiScore >= 0.6;
  const confidence: 'low' | 'medium' | 'high' =
    aiScore >= 0.85 ? 'high' : aiScore >= 0.6 ? 'medium' : 'low';
  return {
    isAiGenerated: isAi,
    confidence,
    note: isAi
      ? `疑似 AI 生成 (置信度 ${(aiScore * 100).toFixed(0)}%), 请人工复核`
      : `未检测到明显 AI 痕迹 (AI 概率 ${(aiScore * 100).toFixed(0)}%)`,
    provider: 'hive',
    raw: data,
  };
}

// ---------- Sensity AI 深度伪造检测 ----------
async function detectWithSensity(base64: string): Promise<AiImageCheckResult> {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const resp = await fetch('https://api.sensity.ai/v1/detect', {
    method: 'POST',
    headers: {
      'X-API-Key': SENSITY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_base64: cleanBase64 }),
  });
  if (!resp.ok) throw new Error(`Sensity API ${resp.status}`);
  const data = await resp.json();
  // Sensity 返回 deepfake_probability (0-1)
  const prob = data?.deepfake_probability ?? 0;
  const isAi = prob >= 0.6;
  const confidence: 'low' | 'medium' | 'high' =
    prob >= 0.85 ? 'high' : prob >= 0.6 ? 'medium' : 'low';
  return {
    isAiGenerated: isAi,
    confidence,
    note: isAi
      ? `疑似 AI/深度伪造 (概率 ${(prob * 100).toFixed(0)}%), 请人工复核`
      : `未检测到明显 AI 痕迹 (AI 概率 ${(prob * 100).toFixed(0)}%)`,
    provider: 'sensity',
    raw: data,
  };
}
