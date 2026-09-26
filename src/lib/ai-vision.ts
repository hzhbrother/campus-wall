// AI 视觉识别: 实名认证初审 + 信息提取
// 支持任意 OpenAI 兼容接口 (OpenAI / DeepSeek / 通义千问 / 豆包 等)
// 通过 AI_VISION_PROVIDER 选择预设, 或用 AI_VISION_BASE_URL + AI_VISION_MODEL 自定义
// 未配置 API Key 时返回 null, 前端降级为纯人工审核

export interface BBox {
  x: number; // 归一化 0-1
  y: number;
  w: number;
  h: number;
}

export interface AiReviewResult {
  isIdCard: boolean;              // 是否为校园卡/学生证/证明材料
  isClear: boolean;               // 是否清晰可辨
  rejectReason?: string;          // AI 初审驳回原因
  info: {
    name?: string;
    studentId?: string;
    grade?: string;
    className?: string;
    school?: string;
  };
  bboxes: {
    name?: BBox;
    studentId?: BBox;
    grade?: BBox;
    className?: BBox;
    school?: BBox;
  };
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

// 各服务商预设 (均为 OpenAI 兼容的 /v1/chat/completions 接口)
const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-vl2',
  },
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-1-5-vision-pro-32k-250115',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
  },
};

const PROVIDER = (process.env.AI_VISION_PROVIDER || '').toLowerCase();
const preset = PROVIDER_PRESETS[PROVIDER];

const API_KEY = process.env.AI_VISION_API_KEY || '';
const BASE_URL = process.env.AI_VISION_BASE_URL || preset?.baseUrl || 'https://api.openai.com/v1';
const MODEL = process.env.AI_VISION_MODEL || preset?.model || 'gpt-4o-mini';

export function isVisionEnabled() {
  return !!API_KEY;
}

// 调用视觉模型, 返回原始文本
async function callVision(prompt: string, photoBase64: string, maxTokens = 800): Promise<string | null> {
  if (!API_KEY) return null;
  const dataUrl = photoBase64.startsWith('data:')
    ? photoBase64
    : `data:image/jpeg;base64,${photoBase64}`;
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error('[ai-vision] request failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('[ai-vision] error:', e);
    return null;
  }
}

function parseJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function normBBox(v: any): BBox | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const x = Number(v.x), y = Number(v.y), w = Number(v.w), h = Number(v.h);
  if ([x, y, w, h].some(n => isNaN(n) || n < 0 || n > 1)) return undefined;
  return { x, y, w, h };
}

// AI 初审: 判断是否校园卡 + 清晰度 + 提取信息(含边界框)
export async function preliminaryReview(photoBase64: string): Promise<AiReviewResult | null> {
  const prompt = `你是校园卡审核助手。请分析这张图片, 判断它是否为校园卡/学生证/学生证明材料, 以及是否清晰可辨, 并提取关键信息。
请以严格 JSON 返回 (不要任何解释文字):
{
  "isIdCard": true/false,
  "isClear": true/false,
  "rejectReason": "若不是校园卡或不清晰, 说明原因; 否则留空",
  "info": {
    "name": "姓名 (无法识别留空)",
    "studentId": "学号 (无法识别留空)",
    "grade": "年级 如高一/初一 (无法识别留空)",
    "className": "班级 如1班 (无法识别留空)",
    "school": "学校名称 (无法识别留空)"
  },
  "bboxes": {
    "name": {"x":0,"y":0,"w":0,"h":0},
    "studentId": {"x":0,"y":0,"w":0,"h":0},
    "grade": {"x":0,"y":0,"w":0,"h":0},
    "className": {"x":0,"y":0,"w":0,"h":0},
    "school": {"x":0,"y":0,"w":0,"h":0}
  },
  "confidence": "high|medium|low"
}
边界框坐标为相对图片宽高的归一化值 (0-1), x/y 为左上角, w/h 为宽高。无法定位的字段 bbox 可省略。`;

  const text = await callVision(prompt, photoBase64, 1000);
  if (!text) return null;
  const parsed = parseJson(text);
  if (!parsed) return null;

  return {
    isIdCard: !!parsed.isIdCard,
    isClear: !!parsed.isClear,
    rejectReason: parsed.rejectReason || undefined,
    info: {
      name: parsed.info?.name || undefined,
      studentId: parsed.info?.studentId || undefined,
      grade: parsed.info?.grade || undefined,
      className: parsed.info?.className || undefined,
      school: parsed.info?.school || undefined,
    },
    bboxes: {
      name: normBBox(parsed.bboxes?.name),
      studentId: normBBox(parsed.bboxes?.studentId),
      grade: normBBox(parsed.bboxes?.grade),
      className: normBBox(parsed.bboxes?.className),
      school: normBBox(parsed.bboxes?.school),
    },
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    rawText: text,
  };
}

// 兼容旧接口: 仅提取信息 (管理端手动触发识图)
export async function extractIdInfo(photoBase64: string): Promise<AiReviewResult | null> {
  return preliminaryReview(photoBase64);
}
